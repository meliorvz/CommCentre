import { useEffect, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '@/contexts/AuthContext';
import { TOUR_STEPS } from '@/lib/help-config';
import { useLocation } from 'react-router-dom';

const TOUR_STORAGE_KEY = 'paradise_tour_seen_v1';

export default function GuidedTour() {
    const { user, isSuperAdmin, canViewBilling } = useAuth(); // canViewBilling approximates Company Admin
    const [run, setRun] = useState(false);
    const [steps, setSteps] = useState<Step[]>([]);
    const location = useLocation();

    useEffect(() => {
        // Only run tour on the main dashboard initially
        if (location.pathname !== '/' || !user) return;

        const hasSeenTour = localStorage.getItem(TOUR_STORAGE_KEY);
        if (hasSeenTour) return;

        // Build steps based on role
        let tourSteps = [...TOUR_STEPS.GENERAL];

        if (canViewBilling) {
            tourSteps = [...tourSteps, ...TOUR_STEPS.ADMIN];
        }

        if (isSuperAdmin) {
            tourSteps = [...tourSteps, ...TOUR_STEPS.SUPER_ADMIN];
        }

        setSteps(tourSteps);
        setRun(true);
    }, [user, isSuperAdmin, canViewBilling, location.pathname]);

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            localStorage.setItem(TOUR_STORAGE_KEY, 'true');
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: 'hsl(var(--primary))',
                    textColor: 'hsl(var(--foreground))',
                    backgroundColor: 'hsl(var(--background))',
                    arrowColor: 'hsl(var(--background))',
                },
                buttonNext: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                },
                buttonBack: {
                    color: 'hsl(var(--foreground))',
                },
            }}
        />
    );
}
