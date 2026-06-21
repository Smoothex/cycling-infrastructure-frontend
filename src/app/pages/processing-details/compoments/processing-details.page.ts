
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';

@Component({
	selector: 'app-processing-details',
	imports: [TranslatePipe, Button],
	templateUrl: './processing-details.page.html',
	styleUrl: './processing-details.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'p-processing-details'
	}
})
export class ProcessingDetailsPage {}
