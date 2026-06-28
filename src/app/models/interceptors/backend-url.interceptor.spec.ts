import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@simra/common-models';

import { backendUrlInterceptor } from './backend-url.interceptor';

describe('backendUrlInterceptor', () => {
	let httpTestingController: HttpTestingController;
	let httpClient: HttpClient;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				{
					provide: APP_CONFIG,
					useValue: {
						apiUrl: 'http://localhost:8080',
					},
				},
				provideHttpClient(withInterceptors([backendUrlInterceptor])),
				provideHttpClientTesting(),
			],
		});

		httpTestingController = TestBed.inject(HttpTestingController);
		httpClient = TestBed.inject(HttpClient);
	});

	it('should return the original request if the request URL does neither starts with the API nor JPA base segment', () => {
		const url = '/non-api/resource';

		httpClient.get(url).subscribe();

		const req = httpTestingController.expectOne(url);
		expect(req.request.url).toEqual(url);
	});

	it('should return a new request with the backend URL if the request URL starts with the API base segment', () => {
		const url = '/api/resource';

		httpClient.get(url).subscribe();

		const req = httpTestingController.expectOne('http://localhost:8080/api/resource');
		expect(req.request.url).toEqual('http://localhost:8080/api/resource');
	});

	it('should not duplicate the API base segment if the configured backend URL already includes it', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: APP_CONFIG,
					useValue: {
						apiUrl: 'http://localhost:8080/api',
					},
				},
				provideHttpClient(withInterceptors([backendUrlInterceptor])),
				provideHttpClientTesting(),
			],
		});
		httpTestingController = TestBed.inject(HttpTestingController);
		httpClient = TestBed.inject(HttpClient);

		httpClient.get('/api/resource').subscribe();

		const req = httpTestingController.expectOne('http://localhost:8080/api/resource');
		expect(req.request.url).toEqual('http://localhost:8080/api/resource');
	});

	it('should add an HTTP protocol if the configured backend URL does not include one', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: APP_CONFIG,
					useValue: {
						apiUrl: 'localhost:8080/api',
					},
				},
				provideHttpClient(withInterceptors([backendUrlInterceptor])),
				provideHttpClientTesting(),
			],
		});
		httpTestingController = TestBed.inject(HttpTestingController);
		httpClient = TestBed.inject(HttpClient);

		httpClient.get('/api/resource').subscribe();

		const req = httpTestingController.expectOne('http://localhost:8080/api/resource');
		expect(req.request.url).toEqual('http://localhost:8080/api/resource');
	});

	it('should return a new request with the backend URL if the request URL starts with the JPA API base segment', () => {
		const url = '/api/jpa/resource';

		httpClient.get(url).subscribe();

		const req = httpTestingController.expectOne('http://localhost:8080/resource');
		expect(req.request.url).toEqual('http://localhost:8080/resource');
	});

	it('should keep JPA requests root-relative if the configured backend URL already includes the API segment', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({
			providers: [
				{
					provide: APP_CONFIG,
					useValue: {
						apiUrl: 'http://localhost:8080/api/',
					},
				},
				provideHttpClient(withInterceptors([backendUrlInterceptor])),
				provideHttpClientTesting(),
			],
		});
		httpTestingController = TestBed.inject(HttpTestingController);
		httpClient = TestBed.inject(HttpClient);

		httpClient.get('/api/jpa/resource').subscribe();

		const req = httpTestingController.expectOne('http://localhost:8080/resource');
		expect(req.request.url).toEqual('http://localhost:8080/resource');
	});
});
