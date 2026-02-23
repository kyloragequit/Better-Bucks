import { AdminLayout } from "@/components/layout-admin";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function AdminDocumentsPage() {
  return (
    <AdminLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full shadow-lg border-primary/20">
          <CardContent className="py-16 text-center space-y-4">
            <Construction className="h-16 w-16 mx-auto text-primary" />
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-under-construction">
              Under Construction
            </h1>
            <p className="text-muted-foreground">
              The Documents feature is currently being built and will be available soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
