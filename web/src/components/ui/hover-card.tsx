import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card"

import { cn } from "@/lib/utils"

function HoverCard({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />
}

function HoverCardTrigger({
  delay = 500,
  ...props
}: PreviewCardPrimitive.Trigger.Props) {
  return (
    <PreviewCardPrimitive.Trigger
      data-slot="hover-card-trigger"
      delay={delay}
      {...props}
    />
  )
}

function HoverCardContent({
  align = "start",
  side = "top",
  sideOffset = 6,
  className,
  ...props
}: PreviewCardPrimitive.Popup.Props &
  Pick<
    PreviewCardPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        side={side}
        sideOffset={sideOffset}
      >
        <PreviewCardPrimitive.Popup
          data-slot="hover-card-content"
          className={cn(
            "z-50 w-96 max-w-[calc(100vw-2rem)] origin-(--transform-origin) rounded-xl bg-popover p-4 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  )
}

export { HoverCard, HoverCardContent, HoverCardTrigger }
