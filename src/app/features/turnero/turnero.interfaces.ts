import { TurnoDTO } from '../../core/models/dto.models';
import { LucideIconData } from 'lucide-angular';

export type SalaMode = 'aps' | 'aps-espera' | 'lab-espera' | 'lab-en-espera' | 'img-espera' | 'img-en-espera' | 'consulta';

export interface APSSeccion {
  id: number;
  titulo: string;
  filtro: {
    estados?: number[];
    servicios?: number[];
    responsable?: number[];
  };
}

export interface SalaConfig {
  titulo: string;
  subtitulo: string;
  estados: number[];
  servicios: number[] | null;
  icon: LucideIconData;
  layout: 'llamados' | 'lista' | 'aps' | 'lab' | 'img';
}

export interface AnuncioActivo {
  idAtencion: number;
  numeroTurno: string | null;
  paciente: string;
  apellido: string;
  consultorio: string;
  piso: string | null;
  destinoInmediato: boolean;
  primerTickInmediato: boolean;
  inicioMs: number | null;
  baseLocal: number;
  timerId: any | null;
  speakTimerId: any | null;
  ultimaVozMs: number;
  audioUrl?: string;
  audioBlobUrl?: string;
  audioPreload?: Promise<string | undefined>;
  pausado?: boolean;
}
