const { getJestProjectsAsync } = require('@nx/jest');

module.exports = async () => ({
	projects: await getJestProjectsAsync(),
	setupFiles: ['<rootDir>/jest.setup.js'],
	transformIgnorePatterns: [
		'node_modules/(?!ngx-markdown|@primeng)'
	],
	moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
});
