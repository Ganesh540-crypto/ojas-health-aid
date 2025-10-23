import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="fixed inset-0 z-[999] bg-background text-foreground flex items-center justify-center">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10 items-center px-6 md:px-10 py-16">
        <div className="space-y-4">
          <div className="text-sm font-medium text-primary">404 error</div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight">We can't find that page</h1>
          <p className="text-muted-foreground">Sorry, the page you are looking for doesn't exist or has been moved.</p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
            <Button asChild>
              <Link to="/app">Take me home</Link>
            </Button>
          </div>
        </div>
        <div className="relative flex items-center justify-center h-64 md:h-80 lg:h-96">
          <div className="select-none font-bold text-[120px] md:text-[180px] lg:text-[220px] leading-none tracking-tight text-foreground/80 relative">
            <span className="block relative glitch-layer" aria-hidden="true">404</span>
            <span className="block absolute inset-0 glitch-layer glitch-red" aria-hidden="true">404</span>
            <span className="block absolute inset-0 glitch-layer glitch-blue" aria-hidden="true">404</span>
          </div>
        </div>
      </div>
      <style>{`
        .glitch-layer{animation: glitch-shift 2.2s infinite steps(2);} 
        .glitch-red{color: hsl(0 85% 55% / 0.5);mix-blend-mode: screen;clip-path: inset(0 0 55% 0);animation-duration: 2.4s;} 
        .glitch-blue{color: hsl(220 90% 60% / 0.5);mix-blend-mode: screen;clip-path: inset(45% 0 0 0);animation-duration: 2s;} 
        @keyframes glitch-shift{ 
          0%{transform: translate(0,0) skew(0deg);} 
          10%{transform: translate(-2px,1px) skew(0.2deg);} 
          20%{transform: translate(2px,-1px) skew(-0.2deg);} 
          30%{transform: translate(-1px,2px);} 
          40%{transform: translate(1px,-2px);} 
          50%{transform: translate(0,0);} 
          60%{transform: translate(1px,1px);} 
          70%{transform: translate(-1px,1px);} 
          80%{transform: translate(1px,-1px);} 
          90%{transform: translate(-1px,-1px);} 
          100%{transform: translate(0,0);} 
        }
      `}</style>
    </div>
  );
};

export default NotFound;
