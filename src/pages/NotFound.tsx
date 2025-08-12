import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>404 - Not Found</CardTitle>
          <CardDescription>The page you’re looking for doesn’t exist.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <a href="/">Return Home</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
