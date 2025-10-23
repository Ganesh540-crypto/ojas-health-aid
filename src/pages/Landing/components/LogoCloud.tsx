import React from 'react';

const startupPrograms = [
  { 
    name: 'Google for Startups', 
    logo: (
      <div className="h-16 flex items-center justify-center">
        <img 
          src="/Google_for_Startups_logo.svg" 
          alt="Google for Startups" 
          className="h-10 w-auto object-contain max-w-[180px]"
        />
      </div>
    )
  },
  { 
    name: 'Microsoft for Startups', 
    logo: (
      <div className="h-16 flex items-center justify-center">
        <img 
          src="/founders-hub.svg" 
          alt="Microsoft for Startups Founders Hub" 
          className="h-10 w-auto object-contain max-w-[180px]"
        />
      </div>
    )
  },
  { 
    name: 'NVIDIA Inception', 
    logo: (
      <div className="h-16 flex items-center justify-center">
        <img 
          src="/nvidia-inception-program-badge-rgb-for-screen.png" 
          alt="NVIDIA Inception" 
          className="h-10 w-auto object-contain max-w-[180px]"
        />
      </div>
    )
  },
];

export const LogoCloud = () => {
  return (
    <section className="bg-background overflow-hidden py-12 md:py-16">
      <div className="group relative m-auto max-w-7xl px-6 sm:px-12 lg:px-16">
        <div className="flex flex-col items-center md:flex-row">
          <div className="md:max-w-44 md:border-r md:pr-6 mb-6 md:mb-0">
            <p className="text-center md:text-end text-sm font-hero">Supported by leading programs</p>
          </div>
          <div className="relative py-6 md:w-[calc(100%-11rem)]">
            <div className="flex items-center justify-center gap-12 md:gap-16 flex-wrap">
              {startupPrograms.map((program, index) => (
                <div key={index} className="flex items-center justify-center">
                  {program.logo}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
