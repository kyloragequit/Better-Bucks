import { useQuery } from "@tanstack/react-query";
import { EmployeeLayout } from "@/components/layout-employee";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { User, Document } from "@shared/schema";

type DocumentWithUploader = Document & { uploadedBy: User };

export default function EmployeeDocumentsPage() {
  const { data: documents = [], isLoading } = useQuery<DocumentWithUploader[]>({
    queryKey: ["/api/documents"],
  });

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-documents-title">My Documents</h1>
          <p className="text-muted-foreground">Documents shared with you by your administrators</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-documents">No documents have been shared with you yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                <CardContent className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-8 w-8 text-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium" data-testid={`text-doc-name-${doc.id}`}>{doc.name}</span>
                        {doc.isDisciplinaryAction && (
                          <Badge variant="destructive" className="text-xs" data-testid={`badge-disciplinary-${doc.id}`}>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Disciplinary Action
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Uploaded by: {doc.uploadedBy?.fullName}
                        {" · "}{format(new Date(doc.createdAt), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">{doc.originalFilename}</div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    data-testid={`button-download-${doc.id}`}
                  >
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download>
                      <Download className="h-4 w-4 mr-1" />
                      View
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </EmployeeLayout>
  );
}
