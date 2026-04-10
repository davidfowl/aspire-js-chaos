import { Component } from '@angular/core';
import { Weather } from './weather/weather';

@Component({
  selector: 'app-root',
  imports: [Weather],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
