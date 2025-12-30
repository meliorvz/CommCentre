import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const SelectContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
    open?: boolean
    setOpen?: (open: boolean) => void
    disabled?: boolean
}>({})

const Select = ({
    value,
    onValueChange,
    children,
    open,
    onOpenChange,
    disabled
}: {
    value?: string
    onValueChange?: (value: string) => void
    children?: React.ReactNode
    open?: boolean
    onOpenChange?: (open: boolean) => void
    disabled?: boolean
}) => {
    const [isOpen, setIsOpen] = React.useState(open || false)

    const handleOpenChange = (newOpen: boolean) => {
        setIsOpen(newOpen)
        onOpenChange?.(newOpen)
    }

    return (
        <SelectContext.Provider value={{ value, onValueChange, open: isOpen, setOpen: handleOpenChange, disabled }}>
            <DropdownMenuPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
                {children}
            </DropdownMenuPrimitive.Root>
        </SelectContext.Provider>
    )
}

const SelectTrigger = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
    const { disabled } = React.useContext(SelectContext)

    return (
        <DropdownMenuPrimitive.Trigger
            ref={ref}
            className={cn(
                "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
                className
            )}
            disabled={disabled}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </DropdownMenuPrimitive.Trigger>
    )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, placeholder, ...props }, ref) => {
    const { value } = React.useContext(SelectContext)
    return (
        <span
            ref={ref}
            className={cn("pointer-events-none", className)}
            {...props}
        >
            {value || placeholder}
        </span>
    )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & { position?: "popper" | "item-aligned" }
>(({ className, children, position = "popper", ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
            ref={ref}
            className={cn(
                "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                position === "popper" &&
                "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                className
            )}
            {...props}
        >
            <div className={cn("p-1", position === "popper" && "w-full min-w-[var(--radix-dropdown-menu-trigger-width)]")}>
                {children}
            </div>
        </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
))
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
    React.ElementRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { value: string }
>(({ className, children, value: itemValue, ...props }, ref) => {
    const { value, onValueChange, setOpen } = React.useContext(SelectContext)
    const isSelected = value === itemValue

    return (
        <DropdownMenuPrimitive.Item
            ref={ref}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                className
            )}
            {...props}
            onSelect={(event) => {
                onValueChange?.(itemValue)
                setOpen?.(false)
                props.onSelect?.(event)
            }}
        >
            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            <DropdownMenuPrimitive.ItemIndicator />
            <span className="truncate">{children}</span>
        </DropdownMenuPrimitive.Item>
    )
})
SelectItem.displayName = "SelectItem"

export {
    Select,
    SelectTrigger,
    SelectContent,
    SelectItem,
    SelectValue,
}
