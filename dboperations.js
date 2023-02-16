require('dotenv').config();
var config = require('./dbconfig');
const sql = require('mssql');
const dateFns = require('date-fns');
const dateFnsTZ = require('date-fns-tz');

let finalResult = [];
const queryText = "SELECT DATE, TIME, HN, VNSEQ, DIVISION, cast(EVENTTIM as time) AS EVENTTIM, STATUS FROM VIEW_STATUS_HN ";

function pushResult(item) {
    const date = new Date();
    finalResult.push({
        DATE : item.DATE,
        TIME : item.TIME,
        HN : item.HN,
        VNSEQ : item.VNSEQ,
        DIVISION : item.DIVISION,
        EVENTTIM : ((date.getHours() - (new Date(item.EVENTTIM).getHours()-7)) * 60) + (date.getMinutes() - new Date(item.EVENTTIM).getMinutes()),
        STATUS : item.STATUS,
    });
}

async function getHNStatus() {
    try {
        finalResult = [];
        console.log("getHNStatus call, try connect to server");
        let pool = await sql.connect(config);
        console.log("connect complete");

        const parsedDate = dateFnsTZ.toDate(dateFns.addYears(new Date(), 543), { timeZone: 'Asia/Bangkok' });
        const bangkokDate = dateFnsTZ.utcToZonedTime(parsedDate, 'Asia/Bangkok');
        const nowDate = dateFnsTZ.format(bangkokDate, 'yyyyMMdd', { timeZone: 'Asia/Bangkok' });

        const giveMed = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND ( STATUS = 'จ่ายยา' OR STATUS = 'ชำระเงิน(คนไข้ไม่มียา)' ) ORDER BY cast(EVENTTIM as time)");
        giveMed.recordsets[0].forEach(pushResult);

        const payBill = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND STATUS = 'ชำระเงิน' ORDER BY cast(EVENTTIM as time)");
        payBill.recordsets[0].forEach(pushResult);

        const treatEnd = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND STATUS = 'จบการรักษา' ORDER BY cast(EVENTTIM as time)");
        treatEnd.recordsets[0].forEach(pushResult);

        const treatProc = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND STATUS = 'รอผล' ORDER BY cast(EVENTTIM as time)");
        treatProc.recordsets[0].forEach(pushResult);

        const treatWait = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND STATUS = 'รอพบแพทย์' ORDER BY cast(EVENTTIM as time)");
        treatWait.recordsets[0].forEach(pushResult);

        const register = await pool.request().input('DATE', sql.VarChar, nowDate)
            .query(queryText + "WHERE DATE = @DATE AND STATUS = 'ลงทะเบียน' ORDER BY cast(EVENTTIM as time)");
        register.recordsets[0].forEach(pushResult);

        console.log("getHNStatus complete");
        console.log("====================");
        return finalResult;
    }
    catch (error) {
        console.error(error);
        return { "status": "error", "message": error.message };
    }
}

module.exports = {
    getHNStatus: getHNStatus,
}