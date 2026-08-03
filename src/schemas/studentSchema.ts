import { z } from 'zod'

const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/

export const studentSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(60, 'Máximo 60 caracteres')
    .regex(NAME_REGEX, 'Solo letras, espacios, guiones y apóstrofes'),
  apellido: z
    .string()
    .trim()
    .min(1, 'El apellido es obligatorio')
    .max(60, 'Máximo 60 caracteres')
    .regex(NAME_REGEX, 'Solo letras, espacios, guiones y apóstrofes'),
  grado: z.string().min(1, 'El grado es obligatorio'),
  division: z.string().min(1, 'La división es obligatoria'),
})

export type StudentFormData = z.infer<typeof studentSchema>

export const manualLlegadaSchema = z.object({
  student_id: z.string().uuid('ID de estudiante inválido'),
})

export type ManualLlegadaData = z.infer<typeof manualLlegadaSchema>

export const GRADOS = [
  '1° año', '2° año', '3° año', '4° año', '5° año', '6° año', '7° año'
]

export const DIVISIONES = ['A', 'B', 'C', 'D']
