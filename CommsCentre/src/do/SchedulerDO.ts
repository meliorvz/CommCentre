import { DurableObject } from 'cloudflare:workers';
import { Env, PropertySettings } from '../types';
import { createDb, stays, messageJobs, threads, properties } from '../db';
import { eq, and, lte } from 'drizzle-orm';
import { sendSms } from '../worker/lib/twilio';
import { sendEmail } from '../worker/lib/mailchannels';
import { interpolateTemplate } from './ThreadDO';

interface ScheduledJob {
    id: number;
    stayId: string;
    threadId: string;
    channel: 'sms' | 'email';
    ruleKey: string;
    templateKey: string;
    sendAt: number; // epoch ms
    status: 'queued' | 'sent' | 'failed' | 'cancelled';
    attempts: number;
}

const SCHEDULE_RULES = {
    T_MINUS_3: { daysOffset: -3, defaultTime: '10:00' },
    T_MINUS_1: { daysOffset: -1, defaultTime: '16:00' },
    DAY_OF: { daysOffset: 0, defaultTime: '09:00' },
};

export class SchedulerDO extends DurableObject<Env> {
    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.initializeStorage();
    }

    private async initializeStorage() {
        await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stay_id TEXT NOT NULL,
        thread_id TEXT,
        channel TEXT NOT NULL,
        rule_key TEXT NOT NULL,
        template_key TEXT NOT NULL,
        send_at INTEGER NOT NULL,
        status TEXT DEFAULT 'queued',
        attempts INTEGER DEFAULT 0,
        idempotency_key TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_send_at ON jobs(send_at) WHERE status = 'queued';
    `);
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/schedule-stay' && request.method === 'POST') {
            return this.handleScheduleStay(request);
        }

        if (url.pathname === '/reschedule-stay' && request.method === 'POST') {
            return this.handleRescheduleStay(request);
        }

        if (url.pathname === '/cancel-stay' && request.method === 'POST') {
            return this.handleCancelStay(request);
        }

        return new Response('Not found', { status: 404 });
    }

    async alarm(): Promise<void> {
        await this.processDueJobs();
        await this.scheduleNextAlarm();
    }

    private async handleScheduleStay(request: Request): Promise<Response> {
        const { stayId } = await request.json() as { stayId: string };

        // Get stay details
        const db = createDb(this.env.DATABASE_URL);
        const [stayData] = await db
            .select({ stay: stays, thread: threads, property: properties })
            .from(stays)
            .leftJoin(threads, eq(threads.stayId, stays.id))
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(eq(stays.id, stayId))
            .limit(1);

        if (!stayData?.stay) {
            return new Response('Stay not found', { status: 404 });
        }

        const stay = stayData.stay;
        const property = stayData.property;
        const thread = stayData.thread;

        // Get property settings
        const settingsJson = await this.env.KV.get(`settings:property:${stay.propertyId}`);
        const settings: PropertySettings = settingsJson
            ? JSON.parse(settingsJson)
            : {
                autoReplyEnabled: true,
                smsEnabled: true,
                emailEnabled: true,
                scheduleT3Time: '10:00',
                scheduleT1Time: '16:00',
                scheduleDayOfTime: '09:00',
            };

        const timezone = property?.timezone || 'Australia/Sydney';
        const checkinDate = new Date(stay.checkinAt);

        // Create jobs for each rule and enabled channel
        const channels: Array<'sms' | 'email'> = [];
        if (settings.smsEnabled && stay.guestPhoneE164) channels.push('sms');
        if (settings.emailEnabled && stay.guestEmail) channels.push('email');

        for (const [ruleKey, rule] of Object.entries(SCHEDULE_RULES)) {
            const timeConfig =
                ruleKey === 'T_MINUS_3'
                    ? settings.scheduleT3Time
                    : ruleKey === 'T_MINUS_1'
                        ? settings.scheduleT1Time
                        : settings.scheduleDayOfTime;

            const sendAt = this.computeSendTime(checkinDate, rule.daysOffset, timeConfig, timezone);

            // Skip if in the past
            if (sendAt <= Date.now()) continue;

            for (const channel of channels) {
                const idempotencyKey = `${stayId}|${ruleKey}|${channel}|${sendAt}`;

                // Upsert job
                await this.ctx.storage.sql.exec(
                    `INSERT OR IGNORE INTO jobs (stay_id, thread_id, channel, rule_key, template_key, send_at, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    stayId,
                    thread?.id || null,
                    channel,
                    ruleKey,
                    `templates:${channel}:${ruleKey}`,
                    sendAt,
                    idempotencyKey
                );
            }
        }

        // Schedule alarm
        await this.scheduleNextAlarm();

        return new Response('OK', { status: 200 });
    }

    private async handleRescheduleStay(request: Request): Promise<Response> {
        const { stayId } = await request.json() as { stayId: string };

        // Cancel existing jobs
        await this.ctx.storage.sql.exec(
            `UPDATE jobs SET status = 'cancelled' WHERE stay_id = ? AND status = 'queued'`,
            stayId
        );

        // Re-schedule
        return this.handleScheduleStay(request);
    }

    private async handleCancelStay(request: Request): Promise<Response> {
        const { stayId } = await request.json() as { stayId: string };

        await this.ctx.storage.sql.exec(
            `UPDATE jobs SET status = 'cancelled' WHERE stay_id = ? AND status = 'queued'`,
            stayId
        );

        return new Response('OK', { status: 200 });
    }

    private async processDueJobs(): Promise<void> {
        const now = Date.now();

        // Get due jobs
        const result = await this.ctx.storage.sql.exec(
            `SELECT * FROM jobs WHERE status = 'queued' AND send_at <= ? LIMIT 10`,
            now
        );

        const jobs = result.toArray() as unknown as ScheduledJob[];

        for (const job of jobs) {
            try {
                await this.sendScheduledMessage(job);

                await this.ctx.storage.sql.exec(
                    `UPDATE jobs SET status = 'sent', attempts = attempts + 1 WHERE id = ?`,
                    job.id
                );
            } catch (err) {
                console.error('Failed to send scheduled message:', err);

                const newAttempts = job.attempts + 1;
                if (newAttempts >= 3) {
                    await this.ctx.storage.sql.exec(
                        `UPDATE jobs SET status = 'failed', attempts = ? WHERE id = ?`,
                        newAttempts,
                        job.id
                    );
                } else {
                    // Retry in 5 minutes
                    await this.ctx.storage.sql.exec(
                        `UPDATE jobs SET send_at = ?, attempts = ? WHERE id = ?`,
                        now + 5 * 60 * 1000,
                        newAttempts,
                        job.id
                    );
                }
            }
        }
    }

    private async sendScheduledMessage(job: ScheduledJob): Promise<void> {
        const db = createDb(this.env.DATABASE_URL);

        // Get stay and property
        const [stayData] = await db
            .select({ stay: stays, property: properties })
            .from(stays)
            .leftJoin(properties, eq(stays.propertyId, properties.id))
            .where(eq(stays.id, job.stayId))
            .limit(1);

        if (!stayData?.stay) {
            throw new Error('Stay not found');
        }

        const stay = stayData.stay;
        const property = stayData.property;

        // Get template
        const templateJson = await this.env.KV.get(job.templateKey);
        if (!templateJson) {
            throw new Error('Template not found');
        }

        const template = JSON.parse(templateJson) as { body: string; subject?: string };

        // Interpolate template
        const body = interpolateTemplate(template.body, stay, property);
        const subject = template.subject
            ? interpolateTemplate(template.subject, stay, property)
            : undefined;

        // Send message
        if (job.channel === 'sms' && stay.guestPhoneE164) {
            await sendSms(this.env, stay.guestPhoneE164, body, property?.supportPhoneE164 || undefined);
        } else if (job.channel === 'email' && stay.guestEmail) {
            await sendEmail(this.env, {
                to: stay.guestEmail,
                from: property?.supportEmail || 'noreply@mark.local',
                subject: subject || 'Message from your host',
                text: body,
            });
        }
    }

    private interpolateTemplate(
        template: string,
        stay: any,
        property: any
    ): string {
        const replacements: Record<string, string> = {
            '{{guest_name}}': stay.guestName || 'Guest',
            '{{property_name}}': property?.name || 'the property',
            '{{property_address}}': property?.addressText || '',
            '{{checkin_time}}': '14:00', // TODO: Make configurable
            '{{checkout_time}}': '10:00',
            '{{property_code}}': '[See check-in instructions]',
            '{{wifi_name}}': '[WiFi details in property]',
            '{{wifi_password}}': '[WiFi details in property]',
        };

        let result = template;
        for (const [key, value] of Object.entries(replacements)) {
            result = result.replace(new RegExp(key, 'g'), value);
        }

        return result;
    }

    private computeSendTime(
        checkinDate: Date,
        daysOffset: number,
        timeConfig: string,
        timezone: string
    ): number {
        const [hours, minutes] = timeConfig.split(':').map(Number);

        const sendDate = new Date(checkinDate);
        sendDate.setDate(sendDate.getDate() + daysOffset);
        sendDate.setHours(hours, minutes, 0, 0);

        // TODO: Handle timezone properly with Intl.DateTimeFormat
        return sendDate.getTime();
    }

    private async scheduleNextAlarm(): Promise<void> {
        const result = await this.ctx.storage.sql.exec(
            `SELECT MIN(send_at) as next_send FROM jobs WHERE status = 'queued'`
        );

        const rows = result.toArray();
        const nextSend = rows[0]?.next_send as number | null;

        if (nextSend) {
            await this.ctx.storage.setAlarm(nextSend);
        }
    }
}
