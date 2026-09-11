import { firstValueFrom, catchError, of, retry } from 'rxjs'
import { HttpClient, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http'
import { getBackendUrl } from '../voz.util'
import { Injectable } from '@angular/core'