import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash, Check, X } from '@phosphor-icons/react';
import { useRequests, useTeams, useSites, useFields, useSchedule } from '@/hooks/use-data';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getTeamById, getSiteById, getFieldById } from '@/lib/data-helpers';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';

export function RequestsTable() {
  const [requests, setRequests] = useRequests();
  const [teams] = useTeams();
  const [sites] = useSites();
  const [fields] = useFields();
  const [schedule] = useSchedule();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const handleApprove = (id: string) => {
    setRequests((current) =>
      (current || []).map(r =>
        r.id === id ? { ...r, status: 'approved' } : r
      )
    );
    toast.success('Request approved');
  };

  const handleReject = (id: string) => {
    setRequests((current) =>
      (current || []).map(r =>
        r.id === id ? { ...r, status: 'rejected' } : r
      )
    );
    toast.success('Request rejected');
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this request?')) {
      setRequests((current) => (current || []).filter(r => r.id !== id));
      toast.success('Request deleted successfully');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Requests</CardTitle>
            <CardDescription>Manage facility, equipment, and cancellation requests</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests && requests.length > 0 ? (
              requests
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(request => {
                  const team = request.teamId ? getTeamById(teams || [], request.teamId) : undefined;
                  const site = request.siteId ? getSiteById(sites || [], request.siteId) : undefined;
                  const field = request.fieldId ? getFieldById(fields || [], request.fieldId) : undefined;
                  const event = request.eventId ? (schedule || []).find(e => e.id === request.eventId) : undefined;
                  
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Badge 
                          variant={
                            request.type === 'facility' 
                              ? 'default' 
                              : request.type === 'cancellation' 
                              ? 'destructive' 
                              : 'secondary'
                          }
                        >
                          {request.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{request.requestedBy}</TableCell>
                      <TableCell>{team?.name || '-'}</TableCell>
                      <TableCell>
                        {request.type === 'facility' && site && field 
                          ? `${site.name} - ${field.name}`
                          : request.type === 'cancellation' && event
                          ? 'Event Cancellation'
                          : '-'
                        }
                      </TableCell>
                      <TableCell>{format(new Date(request.requestedDate), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            request.status === 'approved' 
                              ? 'default'
                              : request.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {request.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="text-left truncate hover:text-primary underline cursor-pointer"
                        >
                          {request.description}
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {request.status === 'pending' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApprove(request.id)}
                                className="gap-1 text-green-600 hover:text-green-700"
                              >
                                <Check size={16} />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(request.id)}
                                className="gap-1 text-red-600 hover:text-red-700"
                              >
                                <X size={16} />
                                Reject
                              </Button>
                            </>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(request.id)}
                            className="gap-1"
                          >
                            <Trash size={16} />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No requests found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              Full details of the request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Type</div>
                <Badge 
                  variant={
                    selectedRequest.type === 'facility' 
                      ? 'default' 
                      : selectedRequest.type === 'cancellation' 
                      ? 'destructive' 
                      : 'secondary'
                  }
                >
                  {selectedRequest.type}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Requested By</div>
                <div className="text-sm">{selectedRequest.requestedBy}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Date</div>
                <div className="text-sm">{format(new Date(selectedRequest.requestedDate), 'MMMM d, yyyy')}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Description</div>
                <div className="text-sm">{selectedRequest.description}</div>
              </div>
              {selectedRequest.reason && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Reason</div>
                  <div className="text-sm bg-muted p-3 rounded-lg">{selectedRequest.reason}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-1">Status</div>
                <Badge
                  variant={
                    selectedRequest.status === 'approved' 
                      ? 'default'
                      : selectedRequest.status === 'rejected'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {selectedRequest.status}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
