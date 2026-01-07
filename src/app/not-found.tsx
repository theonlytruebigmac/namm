import Link from "next/link";
import { Radio, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center">
            <Radio className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
          </div>
          <CardTitle className="text-6xl font-bold text-[hsl(var(--muted-foreground))]">
            404
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            Page not found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-[hsl(var(--muted-foreground))]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            This could be an outdated link or a mistyped URL.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3 justify-center">
          <Link href="/">
            <Button>
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
