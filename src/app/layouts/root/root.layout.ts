import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { FooterComponent } from '../../components/footer/component/footer.component';
import { MenuBarComponent } from '../../components/menu-bar/component/menu-bar.component';

@Component({
	selector: 'app-root-layout',
	imports: [RouterOutlet, MenuBarComponent, FooterComponent],
	templateUrl: './root.layout.html',
	styleUrl: './root.layout.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'app-root-layout',
	},
})
export class RootLayoutComponent {}
