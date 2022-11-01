const http = require('http');
const https = require('https');
const fs = require('fs');
const qs = require('querystring');
const staticHandler = require('serve-handler');
const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const client = require('./client');
const socketServer = require('./socketServer');

module.exports = (options = {}) => {
	const port = options.port || process.env.PORT || 3000;
	const public = options.public || './public';
	const overlayHandler = errorOverlayMiddleware();

	// TLS options
	const key = options.key || null;
	const cert = options.cert || null;
	const secure = (options.secure == true) && fs.existsSync(key) && fs.existsSync(cert);

	return {
		name: 'dev-server',
		async setup(build) {
			// augment build options
			build.initialOptions.banner = build.initialOptions.banner || {};
			build.initialOptions.banner.js = `${build.initialOptions.banner.js || ''};${client()}`;
			if (build.initialOptions.watch !== undefined && !build.initialOptions.watch) console.warn('warning: esbuild-plugin-dev-server is overriding esbuild watch');
			build.initialOptions.watch = true;

			const handler = (req, res) => {
				const parts = req.url.split('?');
				req.query = parts.length > 1 ? qs.parse(parts[1]) : {};
				overlayHandler(req, res, () => {
					staticHandler(req, res, {
						public,
						rewrites: [{ source: '**', destination: '/index.html' }],
					});
				});
			};

			let server = null;
			if (secure === true) {
				server = https.createServer(
					{
						key: fs.readFileSync(key),
						cert: fs.readFileSync(cert),
					},
					handler
				);
			} else {
				server = http.createServer(handler);
			}

			build.onEnd(socketServer(server));
			if (options.beforeListen) options.beforeListen(server);
			await server.listen(port);
			if (options.afterListen) options.afterListen(server);
		},
	};
};

