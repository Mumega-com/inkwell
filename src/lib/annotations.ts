export interface Annotation {
  id: string
  slug: string
  author: string
  type: 'correction' | 'addition' | 'question' | 'endorsement'
  text: string
  date: string
  verified: boolean
}

export interface AnnotationProvider {
  getAnnotations(slug: string): Promise<Annotation[]>
  addAnnotation(
    annotation: Omit<Annotation, 'id' | 'date'>
  ): Promise<Annotation>
}

/**
 * In-memory annotation provider for local development and testing.
 * Replace with a D1, SOS bus, or GitHub-backed provider in production.
 */
export class LocalAnnotationProvider implements AnnotationProvider {
  private store: Map<string, Annotation[]> = new Map()

  async getAnnotations(slug: string): Promise<Annotation[]> {
    return this.store.get(slug) ?? []
  }

  async addAnnotation(
    input: Omit<Annotation, 'id' | 'date'>
  ): Promise<Annotation> {
    const annotation: Annotation = {
      ...input,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    }
    const existing = this.store.get(input.slug) ?? []
    existing.push(annotation)
    this.store.set(input.slug, existing)
    return annotation
  }
}
