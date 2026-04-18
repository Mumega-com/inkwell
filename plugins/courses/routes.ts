import { Hono } from 'hono'
import { requireAuth, authSessionMiddleware } from '../middleware'
import type { AppBindings } from '../types'

// ── Course config ─────────────────────────────────────────────────────────────

interface LessonConfig { slug: string; title: string; order: number; free: boolean; dripDays: number }
interface CourseConfig {
  title: string; description: string; price: number; stripePriceId: string
  lessons: LessonConfig[]
  certificateTemplate: { title: string; issuer: string; description: string }
}

const COURSES: Record<string, CourseConfig> = {
  'ai-governance': {
    title: 'AI Governance Starter Kit',
    description: 'Everything you need to start your ISO 42001 journey.',
    price: 47,
    stripePriceId: 'STARTER_KIT_PRICE_ID',
    lessons: [
      { slug: 'introduction', title: 'Welcome & Overview', order: 1, free: true, dripDays: 0 },
      { slug: 'what-is-iso-42001', title: 'What ISO 42001 Requires', order: 2, free: false, dripDays: 0 },
      { slug: 'risk-assessment', title: 'AI Risk Assessment Framework', order: 3, free: false, dripDays: 1 },
      { slug: 'policy-template', title: 'Your AI Policy (Template)', order: 4, free: false, dripDays: 2 },
      { slug: 'implementation-roadmap', title: 'Implementation Roadmap', order: 5, free: false, dripDays: 3 },
      { slug: 'next-steps', title: 'Next Steps & Certification Path', order: 6, free: false, dripDays: 5 },
    ],
    certificateTemplate: {
      title: 'AI Governance Starter Kit',
      issuer: 'Digid Inc.',
      description: 'Completed the AI Governance Starter Kit covering ISO 42001 fundamentals, risk assessment, and policy development.',
    },
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isLessonAvailable(lesson: LessonConfig, purchasedAt: string): boolean {
  if (lesson.free) return true
  if (lesson.dripDays === 0) return true
  const unlockAt = new Date(purchasedAt)
  unlockAt.setDate(unlockAt.getDate() + lesson.dripDays)
  return unlockAt <= new Date()
}

function daysUntilAvailable(lesson: LessonConfig, purchasedAt: string): number {
  const unlockAt = new Date(purchasedAt)
  unlockAt.setDate(unlockAt.getDate() + lesson.dripDays)
  const diff = unlockAt.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateCertNumber(courseSlug: string): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${courseSlug.slice(0, 3).toUpperCase()}-${ts}-${rand}`
}

// ── Routes ────────────────────────────────────────────────────────────────────

export const courseRoutes = new Hono<AppBindings>()

courseRoutes.use('*', authSessionMiddleware)

// GET /api/courses/:courseSlug/access
courseRoutes.get('/:courseSlug/access', async (c) => {
  const courseSlug = c.req.param('courseSlug')
  const session = c.get('authSession')
  const course = COURSES[courseSlug]
  if (!course) return c.json({ error: 'course_not_found' }, 404)
  if (!session) return c.json({ enrolled: false, reason: 'not_authenticated' })

  const enrollment = await c.env.DB_CORE.prepare(
    'SELECT * FROM course_enrollments WHERE student_id = ? AND course_slug = ? AND status = ?'
  ).bind(session.identityId, courseSlug, 'active').first<{ purchased_at: string }>()

  if (!enrollment) return c.json({ enrolled: false, reason: 'not_purchased' })

  const completed = await c.env.DB_CORE.prepare(
    'SELECT COUNT(*) as n FROM course_progress WHERE student_id = ? AND course_slug = ? AND completed_at IS NOT NULL'
  ).bind(session.identityId, courseSlug).first<{ n: number }>()

  const total = course.lessons.length
  const n = completed?.n ?? 0
  return c.json({
    enrolled: true,
    purchasedAt: enrollment.purchased_at,
    progress: { completed: n, total, percent: total > 0 ? Math.round((n / total) * 100) : 0 },
  })
})

// POST /api/courses/:courseSlug/enroll
courseRoutes.post('/:courseSlug/enroll', requireAuth, async (c) => {
  const courseSlug = c.req.param('courseSlug')
  const session = c.get('authSession')!
  const course = COURSES[courseSlug]
  if (!course) return c.json({ error: 'course_not_found' }, 404)

  const body = await c.req.json<{ studentId?: string; stripeSessionId?: string }>()
  const studentId = body.studentId ?? session.identityId
  const now = new Date().toISOString()

  await c.env.DB_CORE.prepare(
    'INSERT OR IGNORE INTO course_enrollments (id, student_id, course_slug, purchased_at, stripe_session_id) VALUES (?, ?, ?, ?, ?)'
  ).bind(generateId(), studentId, courseSlug, now, body.stripeSessionId ?? null).run()

  return c.json({ enrolled: true })
})

// GET /api/courses/:courseSlug/progress
courseRoutes.get('/:courseSlug/progress', requireAuth, async (c) => {
  const courseSlug = c.req.param('courseSlug')
  const session = c.get('authSession')!
  const course = COURSES[courseSlug]
  if (!course) return c.json({ error: 'course_not_found' }, 404)

  const enrollment = await c.env.DB_CORE.prepare(
    'SELECT purchased_at FROM course_enrollments WHERE student_id = ? AND course_slug = ? AND status = ?'
  ).bind(session.identityId, courseSlug, 'active').first<{ purchased_at: string }>()

  if (!enrollment) return c.json({ error: 'not_enrolled' }, 403)

  const rows = await c.env.DB_CORE.prepare(
    'SELECT lesson_slug, completed_at, quiz_score FROM course_progress WHERE student_id = ? AND course_slug = ?'
  ).bind(session.identityId, courseSlug).all<{ lesson_slug: string; completed_at: string | null; quiz_score: number | null }>()

  type ProgressRow = { lesson_slug: string; completed_at: string | null; quiz_score: number | null }
  const progressMap = new Map<string, ProgressRow>(rows.results.map((r: ProgressRow) => [r.lesson_slug, r]))

  const lessons = course.lessons.map(l => {
    const p = progressMap.get(l.slug)
    const available = enrollment ? isLessonAvailable(l, enrollment.purchased_at) : l.free
    return {
      slug: l.slug,
      title: l.title,
      order: l.order,
      free: l.free,
      completed: !!p?.completed_at,
      completedAt: p?.completed_at ?? null,
      quizScore: p?.quiz_score ?? null,
      available,
      daysUntilAvailable: available ? 0 : daysUntilAvailable(l, enrollment.purchased_at),
    }
  })

  return c.json({ courseSlug, lessons })
})

// POST /api/courses/:courseSlug/complete-lesson
courseRoutes.post('/:courseSlug/complete-lesson', requireAuth, async (c) => {
  const courseSlug = c.req.param('courseSlug')
  const session = c.get('authSession')!
  const course = COURSES[courseSlug]
  if (!course) return c.json({ error: 'course_not_found' }, 404)

  const body = await c.req.json<{ lessonSlug: string; quizScore?: number }>()
  if (!body.lessonSlug) return c.json({ error: 'lessonSlug required' }, 400)

  const enrollment = await c.env.DB_CORE.prepare(
    'SELECT purchased_at FROM course_enrollments WHERE student_id = ? AND course_slug = ? AND status = ?'
  ).bind(session.identityId, courseSlug, 'active').first<{ purchased_at: string }>()

  if (!enrollment) return c.json({ error: 'not_enrolled' }, 403)

  const lesson = course.lessons.find(l => l.slug === body.lessonSlug)
  if (!lesson) return c.json({ error: 'lesson_not_found' }, 404)
  if (!isLessonAvailable(lesson, enrollment.purchased_at)) {
    return c.json({ error: 'lesson_locked' }, 403)
  }

  const now = new Date().toISOString()
  await c.env.DB_CORE.prepare(
    'INSERT INTO course_progress (id, student_id, course_slug, lesson_slug, completed_at, quiz_score) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(student_id, course_slug, lesson_slug) DO UPDATE SET completed_at = excluded.completed_at, quiz_score = excluded.quiz_score'
  ).bind(generateId(), session.identityId, courseSlug, body.lessonSlug, now, body.quizScore ?? null).run()

  // Check if all lessons done
  const done = await c.env.DB_CORE.prepare(
    'SELECT COUNT(*) as n FROM course_progress WHERE student_id = ? AND course_slug = ? AND completed_at IS NOT NULL'
  ).bind(session.identityId, courseSlug).first<{ n: number }>()

  const courseCompleted = (done?.n ?? 0) >= course.lessons.length
  let certificateId: string | undefined

  if (courseCompleted) {
    const existing = await c.env.DB_CORE.prepare(
      'SELECT id FROM course_certificates WHERE student_id = ? AND course_slug = ?'
    ).bind(session.identityId, courseSlug).first<{ id: string }>()

    if (!existing) {
      certificateId = generateId()
      const certNumber = generateCertNumber(courseSlug)
      await c.env.DB_CORE.prepare(
        'INSERT INTO course_certificates (id, student_id, course_slug, student_name, certificate_number) VALUES (?, ?, ?, ?, ?)'
      ).bind(certificateId, session.identityId, courseSlug, session.fullName ?? session.contactValue, certNumber).run()
    } else {
      certificateId = existing.id
    }
  }

  return c.json({ completed: true, courseCompleted, certificateId })
})

// GET /api/courses/:courseSlug/certificate
courseRoutes.get('/:courseSlug/certificate', requireAuth, async (c) => {
  const courseSlug = c.req.param('courseSlug')
  const session = c.get('authSession')!
  const course = COURSES[courseSlug]
  if (!course) return c.json({ error: 'course_not_found' }, 404)

  const cert = await c.env.DB_CORE.prepare(
    'SELECT * FROM course_certificates WHERE student_id = ? AND course_slug = ?'
  ).bind(session.identityId, courseSlug).first<{ student_name: string; certificate_number: string; issued_at: string }>()

  if (!cert) return c.json({ error: 'certificate_not_found' }, 404)

  return c.json({
    studentName: cert.student_name,
    courseName: course.certificateTemplate.title,
    certificateNumber: cert.certificate_number,
    issuedAt: cert.issued_at,
    issuer: course.certificateTemplate.issuer,
    description: course.certificateTemplate.description,
  })
})

// POST /api/courses/check-access
courseRoutes.post('/check-access', authSessionMiddleware, async (c) => {
  const session = c.get('authSession')
  if (!session) return c.json({ hasAccess: false, reason: 'not_authenticated' })

  const body = await c.req.json<{ courseSlug: string }>()
  if (!body.courseSlug) return c.json({ error: 'courseSlug required' }, 400)

  const enrollment = await c.env.DB_CORE.prepare(
    'SELECT id FROM course_enrollments WHERE student_id = ? AND course_slug = ? AND status = ?'
  ).bind(session.identityId, body.courseSlug, 'active').first()

  return c.json({ hasAccess: !!enrollment, reason: enrollment ? 'enrolled' : 'not_purchased' })
})
