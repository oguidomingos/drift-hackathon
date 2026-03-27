// Stub for helius-laserstream Windows native binary.
// The keeper-bot uses BulkAccountLoader (HTTP polling), not gRPC streaming.
// This stub prevents import errors on Windows where the native .node binary
// is not published to npm.
module.exports = {};
