import React from 'react';
import { Button } from '@/components/ui/button';

// Integration Icons
const GmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-9">
    <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
  </svg>
);

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-9">
    <path fill="#1A73E8" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-9">
    <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const MapsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-9">
    <path fill="#4285F4" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
);

export const IntegrationsSection = () => {
  return (
    <section id="integrations" className="py-12 md:py-20 bg-background">
      <div className="mx-auto flex flex-col px-6 sm:px-12 lg:px-16 md:grid md:max-w-7xl md:grid-cols-2 md:gap-12">
        <div className="order-last mt-6 flex flex-col gap-12 md:order-first">
          <div className="space-y-6">
            <h2 className="text-balance text-3xl font-hero md:text-4xl">
              Integrate with your favorite tools
            </h2>
              <p className="text-muted-foreground">
                Connect seamlessly with popular platforms and services to enhance your health workflow.
              </p>
              <Button variant="outline" size="sm">
                Coming Soon
              </Button>
          </div>
        </div>

        <div className="-mx-6 px-6 [mask-image:radial-gradient(ellipse_100%_100%_at_50%_0%,#000_70%,transparent_100%)] sm:mx-auto sm:max-w-md md:-mx-6 md:ml-auto md:mr-0">
          <div className="bg-background dark:bg-muted/50 rounded-2xl border p-3 shadow-lg md:pb-12">
            <div className="grid grid-cols-2 gap-2">
              <Integration
                icon={<GmailIcon />}
                name="Gmail"
                description="Sync your health reminders and appointments directly with Gmail."
              />
              <Integration
                icon={<CalendarIcon />}
                name="Calendar"
                description="Track your wellness routine and medication schedules."
              />
              <Integration
                icon={<WhatsAppIcon />}
                name="WhatsApp"
                description="Get health tips and reminders via WhatsApp messages."
              />
              <Integration
                icon={<MapsIcon />}
                name="Maps"
                description="Find nearby healthcare facilities and wellness centers."
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const Integration = ({ icon, name, description }: { icon: React.ReactNode; name: string; description: string }) => {
  return (
    <div className="hover:bg-muted dark:hover:bg-muted/50 space-y-4 rounded-lg border p-4 transition-colors">
      <div className="flex size-fit items-center justify-center">{icon}</div>
      <div className="space-y-1">
        <h3 className="text-sm font-hero font-medium">{name}</h3>
        <p className="text-muted-foreground line-clamp-1 text-sm md:line-clamp-2">{description}</p>
      </div>
    </div>
  );
};
