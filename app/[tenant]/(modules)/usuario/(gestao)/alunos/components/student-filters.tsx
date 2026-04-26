"use client"

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useDebouncedCallback } from 'use-debounce'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/shared/library/api-client'
import { Input } from '@/app/shared/components/forms/input'
import { FacetedFilter, type FacetedFilterOption } from '@/app/shared/components/ui/faceted-filter'

interface TurmaOption {
    id: string
    nome: string
    cursoNome: string
}

interface Course {
    id: string
    name: string
    usaTurmas?: boolean
}

const statusOptions: FacetedFilterOption[] = [
    { label: 'Ativo', value: 'active' },
    { label: 'Inativo', value: 'inactive' },
]

const cronogramaOptions: FacetedFilterOption[] = [
    { label: 'Com cronograma', value: 'yes' },
    { label: 'Sem cronograma', value: 'no' },
]

export function StudentFilters() {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { replace } = useRouter()
    const [turmas, setTurmas] = useState<TurmaOption[]>([])
    const [courses, setCourses] = useState<Course[]>([])
    const [loadingTurmas, setLoadingTurmas] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch turmas
                const turmasResponse = await apiClient.get<{ data: Array<{ id: string; nome: string; cursoNome: string }> }>('/api/usuario/turmas')
                if (turmasResponse && 'data' in turmasResponse) {
                    setTurmas(turmasResponse.data)
                }

                // Fetch courses for course filter
                const coursesResponse = await apiClient.get<{ data: Course[] }>('/api/curso')
                if (coursesResponse && 'data' in coursesResponse) {
                    setCourses(coursesResponse.data)
                }
            } catch (error) {
                console.error('Error fetching filter options:', error)
            } finally {
                setLoadingTurmas(false)
            }
        }
        fetchData()
    }, [])

    const handleSearch = useDebouncedCallback((term: string) => {
        const params = new URLSearchParams(searchParams)
        if (term) {
            params.set('query', term)
            params.set('page', '1') // Reset to first page on search
        } else {
            params.delete('query')
        }
        replace(`${pathname}?${params.toString()}`)
    }, 300)

    const handleStatusChange = (values: Set<string>) => {
        const params = new URLSearchParams(searchParams)
        const value = values.values().next().value
        if (value) {
            params.set('status', value)
            params.set('page', '1')
        } else {
            params.delete('status')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    const handleCourseChange = (values: Set<string>) => {
        const params = new URLSearchParams(searchParams)
        const value = values.values().next().value
        if (value) {
            params.set('courseId', value)
            params.set('page', '1')
        } else {
            params.delete('courseId')
        }
        // Clear turma filter when changing course
        params.delete('turmaId')
        replace(`${pathname}?${params.toString()}`)
    }

    const handleCronogramaChange = (values: Set<string>) => {
        const params = new URLSearchParams(searchParams)
        const value = values.values().next().value
        if (value) {
            params.set('cronograma', value)
            params.set('page', '1')
        } else {
            params.delete('cronograma')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    const handleTurmaChange = (values: Set<string>) => {
        const params = new URLSearchParams(searchParams)
        const value = values.values().next().value
        if (value) {
            params.set('turmaId', value)
            params.set('page', '1')
        } else {
            params.delete('turmaId')
        }
        replace(`${pathname}?${params.toString()}`)
    }

    const selectedStatus = searchParams.get('status')
    const selectedCourseId = searchParams.get('courseId')
    const selectedTurmaId = searchParams.get('turmaId')
    const selectedCronograma = searchParams.get('cronograma')

    const courseOptions: FacetedFilterOption[] = useMemo(
        () => courses.map((c) => ({ label: c.name, value: c.id })),
        [courses]
    )

    // Filter turmas by selected course if any
    const turmaOptions: FacetedFilterOption[] = useMemo(() => {
        const filtered = selectedCourseId
            ? turmas.filter((t) => {
                const course = courses.find((c) => c.id === selectedCourseId)
                return course && t.cursoNome === course.name
            })
            : turmas

        return filtered.map((t) => ({
            label: selectedCourseId ? t.nome : `${t.nome} (${t.cursoNome})`,
            value: t.id,
        }))
    }, [turmas, courses, selectedCourseId])

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
                <Input
                    type="text"
                    placeholder="Buscar por nome, email ou ID..."
                    className="h-9 md:h-8 pl-9"
                    onChange={(e) => handleSearch(e.target.value)}
                    defaultValue={searchParams.get('query')?.toString()}
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <FacetedFilter
                    title="Status"
                    options={statusOptions}
                    selected={selectedStatus ? new Set([selectedStatus]) : new Set()}
                    onSelectionChange={handleStatusChange}
                />
                <FacetedFilter
                    title="Curso"
                    options={courseOptions}
                    selected={selectedCourseId ? new Set([selectedCourseId]) : new Set()}
                    onSelectionChange={handleCourseChange}
                />
                <FacetedFilter
                    title="Cronograma"
                    options={cronogramaOptions}
                    selected={selectedCronograma ? new Set([selectedCronograma]) : new Set()}
                    onSelectionChange={handleCronogramaChange}
                />
                {!loadingTurmas && turmaOptions.length > 0 && (
                    <FacetedFilter
                        title="Turma"
                        options={turmaOptions}
                        selected={selectedTurmaId ? new Set([selectedTurmaId]) : new Set()}
                        onSelectionChange={handleTurmaChange}
                    />
                )}
            </div>
        </div>
    )
}
