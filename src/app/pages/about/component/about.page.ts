import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { YouTubePlayer } from '@angular/youtube-player';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';

@Component({
	selector: 'app-about',
	imports: [
    TranslatePipe,
    Card,
    NgOptimizedImage,
    ButtonDirective,
    YouTubePlayer
],
	templateUrl: './about.page.html',
	styleUrl: './about.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'app-about',
	},
})
export class AboutPage {}
