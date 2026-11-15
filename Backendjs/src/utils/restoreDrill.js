const crypto=require('node:crypto');
function statements(sql){const out=[];let buffer='',quote=null,comment=false,block=false;
 for(let i=0;i<sql.length;i++){const c=sql[i],next=sql[i+1];if(comment){if(c==='\n'){comment=false;buffer+='\n';}continue;}if(block){if(c==='*'&&next==='/'){block=false;i++;}continue;}
 if(quote){buffer+=c;if(c==='\\'&&quote!=='`'&&next){buffer+=next;i++;}else if(c===quote){if(next===quote){buffer+=next;i++;}else quote=null;}continue;}
 if(c==='-'&&next==='-'&&/\s/.test(sql[i+2]||'')){comment=true;i++;continue;}if(c==='/'&&next==='*'){block=true;i++;continue;}if(["'",'"','`'].includes(c)){quote=c;buffer+=c;continue;}if(c===';'){if(buffer.trim())out.push(buffer.trim());buffer='';}else buffer+=c;
 }if(quote||block||buffer.trim())throw new Error('Incomplete SQL statement.');return out;}
function validateStatement(sql){const text=sql.replace(/'(?:\\.|''|[^'])*'/gs,"''").replace(/"(?:\\.|""|[^"])*"/gs,'""');
 if(/^SET (?:NAMES utf8mb4|time_zone\s*=\s*'\+00:00'|FOREIGN_KEY_CHECKS\s*=\s*[01]|UNIQUE_CHECKS\s*=\s*[01]|SQL_MODE\s*=\s*'NO_AUTO_VALUE_ON_ZERO')$/i.test(sql))return null;
 const match=text.match(/^(?:DROP TABLE IF EXISTS|CREATE TABLE|INSERT INTO)\s+`([a-zA-Z0-9_]{1,64})`(?=\s|\(|$)/i);if(!match)throw new Error('Unsupported SQL command in backup.');
 if(/`\s*\.|\b(?:SELECT|OUTFILE|LOAD_FILE|GRANT|TRIGGER|PROCEDURE|FUNCTION|EVENT|DATABASE|SLEEP|BENCHMARK)\b/i.test(text))throw new Error('Backup contains commands outside the isolated restore scope.');return match[1];}
async function restoreSqlDump({sql,config,source,expected,connect=require('mysql2/promise').createConnection,verify}){
 if(!config.host||!config.user)throw new Error('Configure a dedicated restore-test database server and user.');if(config.multipleStatements)throw new Error('Multiple statements must remain disabled.');
 if(source&&config.host===source.host&&Number(config.port||3306)===Number(source.port||3306)&&config.user===source.user)throw new Error('Use separate restore-test credentials, not the application database user.');
 const queries=statements(sql);for(const q of queries)validateStatement(q);const created=new Set(queries.filter(q=>/^CREATE TABLE/i.test(q)).map(validateStatement));if(!created.size)throw new Error('No tables found in backup.');
 const database='finvera_restore_test_'+crypto.randomBytes(10).toString('hex');let connection,completed=false,cleanup=false,createdDatabase=false;
 try{connection=await connect({...config,database:undefined,multipleStatements:false,connectTimeout:5000});await connection.query('CREATE DATABASE `'+database+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');createdDatabase=true;await connection.changeUser({database});
  const started=Date.now();for(const q of queries){if(Date.now()-started>90000)throw new Error('Restore drill exceeded the time limit.');await connection.query({sql:q,timeout:10000});}
  let rows=0;for(const table of created){const [result]=await connection.query('SELECT COUNT(*) AS n FROM `'+table+'`');rows+=Number(result[0].n);}
  if(expected&&(created.size!==expected.tables||rows!==expected.rows))throw new Error('Restored table and row counts do not match the backup manifest.');if(verify)await verify(connection);completed={tables:created.size,rows};
 }finally{if(connection){try{if(createdDatabase){try{await connection.query({sql:'DROP DATABASE IF EXISTS `'+database+'`',timeout:10000});cleanup=true;}catch(error){error.temporaryDatabase=database;throw error;}}}finally{await connection.end();}}}
 return {ok:true,...completed,cleanedUp:cleanup};
}
module.exports={statements,validateStatement,restoreSqlDump};
