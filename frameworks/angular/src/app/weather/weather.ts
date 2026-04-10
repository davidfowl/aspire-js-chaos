import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface WeatherForecast {
  date: string;
  temperatureC: number;
  summary: string;
}

@Component({
  selector: 'app-weather',
  templateUrl: './weather.html',
})
export class Weather implements OnInit {
  private http = inject(HttpClient);

  forecasts = signal<WeatherForecast[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.http.get<WeatherForecast[]>('/api/weather').subscribe({
      next: (data) => {
        this.forecasts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err instanceof Error ? err.message : String(err.message ?? err));
        this.loading.set(false);
      },
    });
  }
}
