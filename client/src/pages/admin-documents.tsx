import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout-admin";
import { useUser } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Upload, FileText, Download, Trash2, Search, Filter, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { User, Document } from "@shared/schema";

type DocumentWithUsers = Document & { assignedTo: User; uploadedBy: User };

export default function AdminDocumentsPage() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterDisciplinary, setFilterDisciplinary] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [fileName, setFileName] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isDisciplinary, setIsDisciplinary] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isPrimeAdmin = user?.role === "prime_admin";

  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set("search", searchQuery);
  if (filterUser && filterUser !== "all") queryParams.set("assignedToUserId", filterUser);
  if (filterDisciplinary && filterDisciplinary !== "all") queryParams.set("isDisciplinaryAction", filterDisciplinary);
  if (filterDateFrom) queryParams.set("dateFrom", filterDateFrom);
  if (filterDateTo) queryParams.set("dateTo", filterDateTo);
  const qs = queryParams.toString();

  const { data: documents = [], isLoading } = useQuery<DocumentWithUsers[]>({
    queryKey: ["/api/documents", qs],
    queryFn: async () => {
      const res = await fetch(`/api/documents${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const { data: orgUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document uploaded successfully" });
      setUploadOpen(false);
      setFileName("");
      setAssignedTo("");
      setIsDisciplinary(false);
      setSelectedFile(null);
    },
    onError: (e: Error) => {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({ title: "Document deleted" });
    },
  });

  const handleUpload = () => {
    if (!selectedFile || !fileName || !assignedTo) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("name", fileName);
    formData.append("assignedToUserId", assignedTo);
    formData.append("isDisciplinaryAction", String(isDisciplinary));
    uploadMutation.mutate(formData);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterUser("");
    setFilterDisciplinary("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-documents-title">Documents</h1>
            <p className="text-muted-foreground">Upload and manage documents for your team</p>
          </div>
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-document">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="doc-name">Document Name *</Label>
                  <Input
                    id="doc-name"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="e.g. Performance Review Q1"
                    data-testid="input-document-name"
                  />
                </div>
                <div>
                  <Label htmlFor="doc-assign">Assign To *</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger data-testid="select-assign-to">
                      <SelectValue placeholder="Select a person" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgUsers.filter(u => u.role !== "developer").map((u) => (
                        <SelectItem key={u.id} value={String(u.id)} data-testid={`option-user-${u.id}`}>
                          {u.fullName} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="doc-file">File *</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                    data-testid="input-document-file"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="doc-disciplinary"
                    checked={isDisciplinary}
                    onCheckedChange={(checked) => setIsDisciplinary(checked === true)}
                    data-testid="checkbox-disciplinary"
                  />
                  <Label htmlFor="doc-disciplinary" className="text-sm flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Flag as Disciplinary Action
                  </Label>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={uploadMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-upload"
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isPrimeAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Search by name</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Document name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                      data-testid="input-search-documents"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Assigned to</Label>
                  <Select value={filterUser} onValueChange={setFilterUser}>
                    <SelectTrigger data-testid="select-filter-user">
                      <SelectValue placeholder="All people" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All people</SelectItem>
                      {orgUsers.filter(u => u.role !== "developer").map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={filterDisciplinary} onValueChange={setFilterDisciplinary}>
                    <SelectTrigger data-testid="select-filter-type">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="true">Disciplinary Action</SelectItem>
                      <SelectItem value="false">Standard Documents</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">From date</Label>
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    data-testid="input-filter-date-from"
                  />
                </div>
                <div>
                  <Label className="text-xs">To date</Label>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    data-testid="input-filter-date-to"
                  />
                </div>
              </div>
              {(searchQuery || filterUser || filterDisciplinary || filterDateFrom || filterDateTo) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2" data-testid="button-clear-filters">
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading documents...</div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground" data-testid="text-no-documents">No documents found</p>
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
                        Assigned to: <span className="font-medium">{doc.assignedTo?.fullName}</span>
                        {" · "}Uploaded by: {doc.uploadedBy?.fullName}
                        {" · "}{format(new Date(doc.createdAt), "MMM d, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">{doc.originalFilename}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
