import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { inject, NgModule, provideAppInitializer } from '@angular/core';
import { IModuleTranslationOptions, ModuleTranslateLoader } from '@larscom/ngx-translate-module-loader';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';

export function moduleHttpLoaderFactory(http: HttpClient) {
	const baseTranslateUrl = './assets/i18n';

	const options: IModuleTranslationOptions = {
		modules: [
			{
				baseTranslateUrl,
				moduleName: 'app',
				pathTemplate: '{baseTranslateUrl}/app/{language}',
			},
			{
				baseTranslateUrl,
				moduleName: 'components',
				pathTemplate: '{baseTranslateUrl}/common/ui/components/{language}',
			},
			{
				baseTranslateUrl,
				moduleName: 'incidents.ui',
				pathTemplate: '{baseTranslateUrl}/incidents/ui/{language}',
			},
			{
				baseTranslateUrl,
				moduleName: 'regions.browse',
				pathTemplate: '{baseTranslateUrl}/regions/browse/{language}',
			},
			{
				baseTranslateUrl,
				moduleName: 'streets.explorer',
				pathTemplate: '{baseTranslateUrl}/streets/explorer/{language}',
			},
			{
				baseTranslateUrl,
				moduleName: 'intersections',
				pathTemplate: '{baseTranslateUrl}/intersections/{language}',
			},
		],
	};

	return new ModuleTranslateLoader(http, options);
}

@NgModule({
	imports: [
		CommonModule,
		HttpClientModule,

		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useFactory: moduleHttpLoaderFactory,
				deps: [ HttpClient ]
			}
		})
	],
	providers: [
		provideAppInitializer(() => {
        const initializerFn = (() => {
				const translateService = inject(TranslateService);
				return () => {
					translateService.setDefaultLang('de');
					translateService.use(navigator.language.substring(0, 2));
				};
			})();
        return initializerFn();
      })
	],
	exports: [ TranslateModule ]
})
export class AppTranslationModule {

}

