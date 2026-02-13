const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [
		'./libs/**/*.{html,ts}',
		join(__dirname, 'src/**/!(*.stories|*.spec).{ts,html}'),
		...createGlobPatternsForDependencies(__dirname),
	],
	theme: {
		extend: {},
	},
	plugins: [
		require('tailwindcss-primeui'),
	],
};
