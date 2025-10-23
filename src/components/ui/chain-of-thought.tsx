import * as React from "react";
import { ChevronRight, Dot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

// Context for sharing state between components
interface ChainOfThoughtContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ChainOfThoughtContext = React.createContext<ChainOfThoughtContextType | undefined>(
  undefined
);

const useChainOfThought = () => {
  const context = React.useContext(ChainOfThoughtContext);
  if (!context) {
    throw new Error("ChainOfThought components must be used within ChainOfThought");
  }
  return context;
};

// Main ChainOfThought component
export interface ChainOfThoughtProps extends React.ComponentProps<"div"> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ChainOfThought({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  className,
  ...props
}: ChainOfThoughtProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <ChainOfThoughtContext.Provider value={{ open, setOpen }}>
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className={cn("w-full", className)}
        {...props}
      >
        {children}
      </Collapsible>
    </ChainOfThoughtContext.Provider>
  );
}

// Header component
export interface ChainOfThoughtHeaderProps
  extends React.ComponentProps<typeof CollapsibleTrigger> {
  children?: React.ReactNode;
}

export function ChainOfThoughtHeader({
  children = "Chain of Thought",
  className,
  ...props
}: ChainOfThoughtHeaderProps) {
  const { open } = useChainOfThought();

  return (
    <CollapsibleTrigger
      className={cn(
        "flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors",
        "group w-fit",
        className
      )}
      {...props}
    >
      <ChevronRight
        className={cn(
          "h-4 w-4 transition-transform duration-200",
          open && "rotate-90"
        )}
      />
      <span>{children}</span>
    </CollapsibleTrigger>
  );
}

// Content wrapper
export interface ChainOfThoughtContentProps
  extends React.ComponentProps<typeof CollapsibleContent> {}

export function ChainOfThoughtContent({
  className,
  children,
  ...props
}: ChainOfThoughtContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "overflow-hidden transition-all duration-300",
        "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down",
        className
      )}
      {...props}
    >
      <div className="pt-2 space-y-0">{children}</div>
    </CollapsibleContent>
  );
}

// Step component with connecting line
export interface ChainOfThoughtStepProps extends React.ComponentProps<"div"> {
  icon?: LucideIcon;
  label: string;
  description?: string;
  status?: "complete" | "active" | "pending";
}

export function ChainOfThoughtStep({
  icon: Icon = Dot,
  label,
  description,
  status = "complete",
  children,
  className,
  ...props
}: ChainOfThoughtStepProps) {
  const statusColors = {
    complete: "text-foreground",
    active: "text-primary",
    pending: "text-muted-foreground",
  };

  const iconColors = {
    complete: "text-foreground/60",
    active: "text-primary",
    pending: "text-muted-foreground/40",
  };

  const lineColors = {
    complete: "bg-border",
    active: "bg-primary/40",
    pending: "bg-border/30",
  };

  return (
    <div className={cn("group relative pb-3 last:pb-0", className)} {...props}>
      <div className="flex items-stretch gap-3 relative min-h-0">
        {/* Icon with connecting line */}
        <div className="relative flex flex-col" style={{ width: '24px' }}>
          <div className={cn("flex-shrink-0 rounded-full p-1 z-10 bg-background", iconColors[status])}>
            <Icon className="h-4 w-4" />
          </div>
          {/* Vertical connecting line from icon to next step */}
          <div 
            className={cn(
              "w-0.5 flex-1 group-last:hidden mt-2",
              lineColors[status]
            )} 
            style={{ 
              marginLeft: '11px',
              marginBottom: '-12px'
            }}
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-0.5 pt-0.5">
          <div className={cn("text-sm font-medium leading-snug", statusColors[status])}>
            {label}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
          {children && <div className="pt-1.5">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// Search Results container
export interface ChainOfThoughtSearchResultsProps
  extends React.ComponentProps<"div"> {}

export function ChainOfThoughtSearchResults({
  children,
  className,
  ...props
}: ChainOfThoughtSearchResultsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} {...props}>
      {children}
    </div>
  );
}

// Individual Search Result
export interface ChainOfThoughtSearchResultProps
  extends React.ComponentProps<typeof Badge> {}

export function ChainOfThoughtSearchResult({
  children,
  className,
  ...props
}: ChainOfThoughtSearchResultProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-normal text-xs px-2.5 py-1",
        "bg-muted border border-border/50",
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

// Image component with caption
export interface ChainOfThoughtImageProps extends React.ComponentProps<"div"> {
  caption?: string;
}

export function ChainOfThoughtImage({
  caption,
  children,
  className,
  ...props
}: ChainOfThoughtImageProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="rounded-lg overflow-hidden border border-border">
        {children}
      </div>
      {caption && (
        <div className="text-xs text-muted-foreground text-center px-2">
          {caption}
        </div>
      )}
    </div>
  );
}
