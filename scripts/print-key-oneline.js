const fs = require('fs')
const key = fs.readFileSync(__dirname + '/../keys/private.pem', 'utf8')
process.stdout.write(key.trim().split('\n').join('\\n') + '\n')
