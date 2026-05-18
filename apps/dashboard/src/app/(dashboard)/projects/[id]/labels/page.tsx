'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Plus, Trash2, Tag } from 'lucide-react'
import { api } from '@/lib/api-client'
import type { Label, Project } from '@platform/shared-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LabelBadge } from '@/components/labels/label-badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label as FormLabel } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#64748b', // slate
  '#78716c', // stone
]

export default function LabelsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', color: PRESET_COLORS[0] })

  const { data: project } = useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => api.get<Project>(`/projects/${projectId}`),
  })

  const { data: labels = [], isLoading } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => api.get<Label[]>(`/labels?projectId=${projectId}`),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      api.post<Label>('/labels', { ...data, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
      setOpen(false)
      setForm({ name: '', color: PRESET_COLORS[0] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/labels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
    },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {project?.name} — Labels
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {labels.length} label{labels.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2" size="sm">
          <Plus className="h-4 w-4" />
          New Label
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      ) : labels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No labels yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Create labels to organise and filter tickets.
            </p>
            <Button size="sm" onClick={() => setOpen(true)}>
              Create first label
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
            >
              <LabelBadge label={label} className="flex-shrink-0" />
              <span className="text-sm flex-1">{label.name}</span>
              <code className="text-xs text-muted-foreground hidden sm:block">
                {label.color}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => {
                  if (confirm(`Delete label "${label.name}"?`)) {
                    deleteMutation.mutate(label.id)
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create label</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (form.name.trim()) createMutation.mutate(form)
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <FormLabel htmlFor="label-name">Name</FormLabel>
              <Input
                id="label-name"
                placeholder="e.g. bug, enhancement, blocked"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <FormLabel>Colour</FormLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? 'white' : 'transparent',
                      outline: form.color === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '1px',
                    }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-6 w-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                  title="Custom colour"
                />
              </div>
              <div className="pt-1">
                <LabelBadge
                  label={{ id: 'preview', name: form.name || 'Preview', color: form.color, projectId, createdAt: '' }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!form.name.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
