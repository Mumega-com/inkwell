import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../../src/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../src/components/ui/table'
import { Badge } from '../../../src/components/ui/badge'
import { Button } from '../../../src/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../src/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../src/components/ui/select'
import { cn } from '../../../src/lib/utils'
import { config } from '../../../src/lib/config'

type Priority = 'critical' | 'high' | 'medium' | 'low'
type TaskStatus = 'backlog' | 'in_progress' | 'done'

interface Task {
  id: string
  title: string
  description?: string
  priority: Priority
  status: TaskStatus
  assignee?: string
  squad?: string
  created_at: string
}

interface Squad {
  id: string
  name: string
}

const PRIORITY_BADGE_VARIANT: Record<Priority, 'default' | 'destructive' | 'outline' | 'secondary'> = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
  low: 'outline',
}

const PRIORITY_LABELS: Record<string, string> = config.brand?.priorityLabels || {}

const PRIORITY_CLASS: Record<Priority, string> = {
  critical: 'text-red-500',
  high: 'text-amber-500',
  medium: 'text-cyan-400',
  low: 'text-muted-foreground',
}

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="p-3 flex flex-col gap-2">
      <p className="text-sm font-semibold leading-snug">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge
          variant={PRIORITY_BADGE_VARIANT[task.priority]}
          className={cn('text-[0.68rem] font-bold', PRIORITY_CLASS[task.priority])}
        >
          {PRIORITY_LABELS[task.priority]}
        </Badge>
        {task.squad && (
          <Badge variant="outline" className="text-[0.68rem] text-muted-foreground">
            {task.squad}
          </Badge>
        )}
      </div>
      {task.assignee && (
        <p className="text-xs text-muted-foreground">→ {task.assignee}</p>
      )}
    </Card>
  )
}

interface CreateTaskFormProps {
  squads: Squad[]
  onCreated: (task: Task) => void
  onClose: () => void
  apiUrl: string
  authToken: string
}

function CreateTaskForm({ squads, onCreated, onClose, apiUrl, authToken }: CreateTaskFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [squadId, setSquadId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSubmitting(true)
    setError('')
    fetch(`${apiUrl}/my/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: title.trim(), description, priority, squad: squadId || undefined }),
    })
      .then(r => r.json())
      .then((task: Task) => { onCreated(task); onClose() })
      .catch(() => { setError('Failed to create task. Try again.'); setSubmitting(false) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title…"
          required
          autoFocus
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Optional description…"
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-vertical"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Priority</label>
        <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {squads.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Squad</label>
          <Select value={squadId || '__unassigned'} onValueChange={v => setSquadId(v === '__unassigned' ? '' : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned">Unassigned</SelectItem>
              {squads.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitting}
          className="bg-amber-500 text-black font-bold hover:bg-amber-400"
        >
          {submitting ? 'Creating…' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}

export function TaskBoard() {
  const [apiUrl, setApiUrl] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)
  const [configMissing, setConfigMissing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterSquad, setFilterSquad] = useState('__all')
  const [filterPriority, setFilterPriority] = useState('__all')
  const [view, setView] = useState<'kanban' | 'table'>('kanban')

  useEffect(() => {
    const url = localStorage.getItem('inkwell_api_url')
    const token = localStorage.getItem('inkwell_auth_token')
    if (!url || !token) {
      setConfigMissing(true)
      setLoading(false)
      return
    }
    setApiUrl(url)
    setAuthToken(token)
  }, [])

  useEffect(() => {
    if (!apiUrl || !authToken) return
    Promise.all([
      fetch(`${apiUrl}/my/tasks`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()),
      fetch(`${apiUrl}/my/squads`, { headers: { 'Authorization': `Bearer ${authToken}` } }).then(r => r.json()),
    ])
      .then(([t, s]: [Task[], Squad[]]) => {
        setTasks(Array.isArray(t) ? t : [])
        setSquads(Array.isArray(s) ? s : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [apiUrl, authToken])

  if (configMissing) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm mb-4">
          Task board is not configured yet. Set your API URL and auth token to get started.
        </p>
        <Button asChild variant="outline" size="sm">
          <a href="/dashboard/settings">Go to Settings</a>
        </Button>
      </Card>
    )
  }

  const filtered = tasks.filter(t => {
    if (filterSquad !== '__all' && t.squad !== filterSquad) return false
    if (filterPriority !== '__all' && t.priority !== filterPriority) return false
    return true
  })

  const byStatus = (status: TaskStatus) => filtered.filter(t => t.status === status)

  function handleCreated(task: Task) {
    setTasks(prev => [task, ...prev])
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterSquad} onValueChange={setFilterSquad}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="All Squads" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Squads</SelectItem>
            {squads.map(s => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-1 ml-auto">
          <Button
            variant={view === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('kanban')}
            className="text-xs"
          >
            Board
          </Button>
          <Button
            variant={view === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
            className="text-xs"
          >
            Table
          </Button>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-amber-500 text-black font-bold hover:bg-amber-400">
              + New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[460px]">
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            {apiUrl && authToken && (
              <CreateTaskForm
                squads={squads}
                onCreated={handleCreated}
                onClose={() => setDialogOpen(false)}
                apiUrl={apiUrl}
                authToken={authToken}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Board / Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-8">Loading tasks…</p>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 items-start overflow-x-auto pb-2">
          {COLUMNS.map(col => (
            <div
              key={col.key}
              className="flex-1 min-w-[240px] rounded-lg border bg-muted/20 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b">
                <span className="font-bold text-sm">{col.label}</span>
                <Badge variant="outline" className="ml-auto font-mono text-xs">
                  {byStatus(col.key).length}
                </Badge>
              </div>
              <div className="p-3 flex flex-col gap-2 min-h-[120px]">
                {byStatus(col.key).map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {byStatus(col.key).length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Task</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Squad</TableHead>
                <TableHead>Assignee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No tasks match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium text-sm">{task.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">
                        {task.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={PRIORITY_BADGE_VARIANT[task.priority]}
                        className={cn('text-xs', PRIORITY_CLASS[task.priority])}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.squad ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {task.assignee ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
