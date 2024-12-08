import pino from 'pino';
// import fs from 'fs';
// import path from 'path';


// // Ensure the logs directory exists
// const logsDir = path.resolve('./logs');
// if (!fs.existsSync(logsDir)) {
//     fs.mkdirSync(logsDir);
// }



// // Create a write stream for the log file
// const logFileStream = fs.createWriteStream(path.join(logsDir, 'application.log'), { flags: 'a' });

// const logger = pino(
//     {
//         level: 'debug', // Set the desired log level
//         transport: {
//             target: 'pino-pretty', // Human-readable logs in terminal
//             options: { colorize: true }, // Colorize logs for console
//         },
//     },
//     logFileStream // Write logs to the file
// );

// export default logger;

const logger = {
  debug: (msg, obj) => console.debug(`[DEBUG] ${msg}`, obj),
  info: (msg, obj) => console.info(`[INFO] ${msg}`, obj),
  warn: (msg, obj) => console.warn(`[WARN] ${msg}`, obj),
  error: (msg, obj) => console.error(`[ERROR] ${msg}`, obj),
};

export default logger;
