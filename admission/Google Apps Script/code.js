// ==========================================
const SHEET_ID = "1wVRwhr8sNTiSX6T2dlvx1z1KJx4bYB8u5_DBuscKYe8"; 
// ==========================================

const SHEET_PRESIDENT = "ประธานนักเรียน";
const SHEET_COMMITTEE = "กรรมการนักเรียน";
const SHEET_STUDENTS = "Students_M4";
const SHEET_SETTINGS = "Settings"; 
const SHEET_JUDGES = "Judges"; 
const SHEET_SCORES = "Scores"; 

function getThaiDateString() {
  var d = new Date();
  var time = Utilities.formatDate(d, "Asia/Bangkok", "HH:mm");
  var day = parseInt(Utilities.formatDate(d, "Asia/Bangkok", "dd"), 10);
  var mStr = Utilities.formatDate(d, "Asia/Bangkok", "MM");
  var thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  var year = parseInt(Utilities.formatDate(d, "Asia/Bangkok", "yyyy"), 10) + 543;
  return day + " " + thaiMonths[parseInt(mStr, 10) - 1] + " " + year + " เวลา " + time + " น.";
}

function setupSheets(ss) {
  let setSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!setSheet) {
    setSheet = ss.insertSheet(SHEET_SETTINGS);
    setSheet.appendRow(["Key", "Value"]);
    setSheet.appendRow(["SystemStatus", "open"]);
    setSheet.appendRow(["CurrentAcademicYear", "2569"]);
    setSheet.appendRow(["LastUpdatedM4", "ยังไม่มีข้อมูล"]);
    setSheet.appendRow(["AppStartTime", ""]);
    setSheet.appendRow(["AppEndTime", ""]);
    setSheet.appendRow(["ConfirmStartTime", ""]);
    setSheet.appendRow(["ConfirmEndTime", ""]);
    setSheet.appendRow(["InterviewAnnounceTime", ""]);
    setSheet.appendRow(["InterviewStartTime", ""]);
    setSheet.appendRow(["InterviewLocation", ""]);
    setSheet.appendRow(["InterviewNote", ""]);
    setSheet.appendRow(["ResultAnnounceTime", ""]);
  }

  let pSheet = ss.getSheetByName(SHEET_PRESIDENT);
  if (!pSheet) {
    pSheet = ss.insertSheet(SHEET_PRESIDENT);
    let headers = ["Timestamp", "เลขที่ใบสมัคร", "ปีการศึกษา", "รหัสนักเรียน", "ชื่อ-สกุล", "ห้อง", "ชื่อพรรค", "สโลแกน", "นโยบาย", "ลิงก์รูปภาพ", "สถานะ", "PDF_Link"];
    for (let i = 2; i <= 30; i++) { headers.push("ชื่อสมาชิก " + i); headers.push("ห้องสมาชิก " + i); }
    pSheet.appendRow(headers);
    pSheet.getRange("A1:CM1").setFontWeight("bold").setBackground("#f3e5f5");
  }

  let cSheet = ss.getSheetByName(SHEET_COMMITTEE);
  if (!cSheet) {
    cSheet = ss.insertSheet(SHEET_COMMITTEE);
    cSheet.appendRow(["Timestamp", "เลขที่ใบสมัคร", "ปีการศึกษา", "รหัสนักเรียน", "ชื่อ-สกุล", "ห้อง", "ชื่อพรรค", "ลิงก์รูปภาพ", "สถานะ", "PDF_Link"]);
    cSheet.getRange("A1:J1").setFontWeight("bold").setBackground("#e3f2fd");
  }

  let stuSheet = ss.getSheetByName(SHEET_STUDENTS);
  if (!stuSheet) {
    stuSheet = ss.insertSheet(SHEET_STUDENTS);
    stuSheet.appendRow(["รหัสนักเรียน", "ชื่อ-สกุล", "ห้อง"]);
    stuSheet.getRange("A1:C1").setFontWeight("bold");
  }

  let jSheet = ss.getSheetByName(SHEET_JUDGES);
  if (!jSheet) {
    jSheet = ss.insertSheet(SHEET_JUDGES);
    jSheet.appendRow(["Timestamp", "ชื่อ-สกุล", "อีเมลโรงเรียน"]);
    jSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#f3e5f5"); 
  }

  let scoreSheet = ss.getSheetByName(SHEET_SCORES);
  if (!scoreSheet) {
    scoreSheet = ss.insertSheet(SHEET_SCORES);
    scoreSheet.appendRow(["Timestamp", "เลขที่ใบสมัคร", "อีเมลกรรมการ", "S1_แต่งกาย", "S2_บุคลิกภาพ", "S3_ทัศนคติ", "S4_ผู้นำ", "S5_แก้ปัญหา", "S6_รับผิดชอบ", "S7_คอมพิวเตอร์", "TotalScore"]);
    scoreSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#fff9c4"); 
  }
}

function getSettings(ss) {
  let data = ss.getSheetByName(SHEET_SETTINGS).getDataRange().getValues();
  let settings = {};
  for(let i=1; i<data.length; i++) { 
    let val = data[i][1];
    if (val instanceof Date) { val = Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm"); }
    settings[data[i][0]] = val; 
  }
  return settings;
}

function updateSetting(ss, key, value) {
  let sheet = ss.getSheetByName(SHEET_SETTINGS);
  let data = sheet.getDataRange().getValues();
  for(let i=1; i<data.length; i++) {
    if(data[i][0] === key) { sheet.getRange(i+1, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value]);
}

function doPost(e) {
  var output = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID); 
    setupSheets(ss);
    var settings = getSettings(ss);

    // ========================================================
    // 🟠 ส่วนระบบรับสมัครเดิม (Admin Dashboard & Student)
    // ========================================================
    if (data.action === "getStudentInit") {
      var stuData = ss.getSheetByName(SHEET_STUDENTS).getDataRange().getValues();
      var students = {};
      for (var i = 1; i < stuData.length; i++) { students[stuData[i][0].toString()] = { name: stuData[i][1], room: stuData[i][2] }; }
      
      var applied = {};
      var availableParties = [];
      var currentYear = settings.CurrentAcademicYear ? settings.CurrentAcademicYear.toString() : "";

      var pRows = ss.getSheetByName(SHEET_PRESIDENT).getDataRange().getValues();
      for (var i = 1; i < pRows.length; i++) {
        if (pRows[i][3]) {
          applied[pRows[i][3].toString()] = { appNumber: pRows[i][1], role: SHEET_PRESIDENT, status: pRows[i][10], party: pRows[i][6], sheet: SHEET_PRESIDENT, rowIndex: i + 1, room: pRows[i][5], studentId: pRows[i][3].toString() };
          let rowYear = pRows[i][2] ? pRows[i][2].toString() : "";
          let pName = pRows[i][6];
          if (rowYear === currentYear && pName && pName !== "ผู้สมัครอิสระ" && !availableParties.includes(pName)) {
            availableParties.push(pName);
          }
        }
      }

      var cRows = ss.getSheetByName(SHEET_COMMITTEE).getDataRange().getValues();
      for (var i = 1; i < cRows.length; i++) {
        if (cRows[i][3]) applied[cRows[i][3].toString()] = { appNumber: cRows[i][1], role: SHEET_COMMITTEE, status: cRows[i][8], party: cRows[i][6], sheet: SHEET_COMMITTEE, rowIndex: i + 1, room: cRows[i][5], studentId: cRows[i][3].toString() };
      }

      let confirmedList = Object.values(applied).filter(a => a.status === 'ยืนยันสมัครต่อ' || a.status === 'ผ่านการคัดเลือก' || a.status === 'ไม่ผ่านการคัดเลือก' || a.status === 'ขาดสอบ');
      
      confirmedList.sort((a,b) => {
        let roomA = parseInt(String(a.room).match(/\d+$/) || 999, 10);
        let roomB = parseInt(String(b.room).match(/\d+$/) || 999, 10);
        if (roomA !== roomB) return roomA - roomB;
        return a.studentId.localeCompare(b.studentId);
      });
      confirmedList.forEach((a, idx) => a.queueNumber = idx + 1);

      return output.setContent(JSON.stringify({ status: "success", settings: settings, students: students, applied: applied, parties: availableParties }));
    }

    if (data.action === "getAdminData") {
      var allApps = [];
      var pData = ss.getSheetByName(SHEET_PRESIDENT).getDataRange().getValues();
      for (var i = 1; i < pData.length; i++) {
        if (pData[i][3] && pData[i][3] !== "รหัสนักเรียน") {
          let d = pData[i][0];
          allApps.push({ sheet: SHEET_PRESIDENT, rowIndex: i + 1, Timestamp: d instanceof Date ? d.toISOString() : d, appNumber: pData[i][1], academicYear: pData[i][2], studentId: pData[i][3].toString(), name: pData[i][4], room: pData[i][5].toString(), position: 'ประธานนักเรียน', party: pData[i][6], photoUrl: pData[i][9], status: pData[i][10], pdfLink: pData[i][73] });
        }
      }
      var cData = ss.getSheetByName(SHEET_COMMITTEE).getDataRange().getValues();
      for (var i = 1; i < cData.length; i++) {
        if (cData[i][3] && cData[i][3] !== "รหัสนักเรียน") {
          let d = cData[i][0];
          allApps.push({ sheet: SHEET_COMMITTEE, rowIndex: i + 1, Timestamp: d instanceof Date ? d.toISOString() : d, appNumber: cData[i][1], academicYear: cData[i][2], studentId: cData[i][3].toString(), name: cData[i][4], room: cData[i][5].toString(), position: 'กรรมการนักเรียน', party: cData[i][6], photoUrl: cData[i][7], status: cData[i][8], pdfLink: cData[i][13] });
        }
      }

      let confirmedAdminApps = allApps.filter(a => a.status === 'ยืนยันสมัครต่อ' || a.status === 'ผ่านการคัดเลือก' || a.status === 'ไม่ผ่านการคัดเลือก' || a.status === 'ขาดสอบ');
      confirmedAdminApps.sort((a, b) => {
        let roomA = parseInt(a.room.match(/\d+$/) || 999, 10);
        let roomB = parseInt(b.room.match(/\d+$/) || 999, 10);
        if (roomA !== roomB) return roomA - roomB;
        return a.studentId.localeCompare(b.studentId);
      });
      confirmedAdminApps.forEach((app, idx) => app.queueNumber = idx + 1); 

      allApps.sort((a,b) => new Date(b.Timestamp) - new Date(a.Timestamp));
      return output.setContent(JSON.stringify({ status: "success", data: allApps, settings: settings }));
    }

    if (data.action === "updateSettings") {
      var oldSettings = getSettings(ss); // ดึงการตั้งค่าเดิมมาเทียบก่อน
      Object.keys(data).forEach(key => { 
        if(key !== "action") {
          updateSetting(ss, key, data[key]); 
          
          // 🟢 เช็คว่าถ้ามีการเปลี่ยน "เวลา" ให้รีเซ็ตสถานะกลับไปเป็น "ยังไม่แจ้งเตือน" (false)
          if (["AppEndTime", "ConfirmStartTime", "ConfirmEndTime", "InterviewAnnounceTime", "ResultAnnounceTime"].includes(key)) {
             if (oldSettings[key] !== data[key]) {
                 updateSetting(ss, "Notified_" + key, "false");
             }
          }
        }
      });
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    if (data.action === "batchUpdateStatus") {
      data.updates.forEach(upd => {
        var col = upd.sheet === SHEET_PRESIDENT ? 11 : 9;
        ss.getSheetByName(upd.sheet).getRange(upd.rowIndex, col).setValue(upd.status);
      });
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    if (data.action === "uploadStudents") {
      var stuSheet = ss.getSheetByName(SHEET_STUDENTS);
      stuSheet.clear();
      stuSheet.appendRow(["รหัสนักเรียน", "ชื่อ-สกุล", "ห้อง"]);
      stuSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#e3f2fd");

      var rows = data.students.map(s => [s.id, s.name, s.room]);
      if (rows.length > 0) stuSheet.getRange(2, 1, rows.length, 3).setValues(rows);
      
      updateSetting(ss, "LastUpdatedM4", getThaiDateString());
      return output.setContent(JSON.stringify({ status: "success", count: rows.length }));
    }

    if (data.action === "deleteStudents") {
      var stuSheet = ss.getSheetByName(SHEET_STUDENTS);
      stuSheet.clear();
      stuSheet.appendRow(["รหัสนักเรียน", "ชื่อ-สกุล", "ห้อง"]);
      stuSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#e3f2fd");
      updateSetting(ss, "LastUpdatedM4", "ยังไม่มีข้อมูล");
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    // ========================================================
    // 🟢 ระบบ Proxy ดึงข้อมูลเว็บโรงเรียนเพื่อแก้ปัญหา CORS
    // ========================================================
    if (data.action === "fetchSchoolWeb") {
      try {
        // ให้ Server ของ Google เป็นคนวิ่งไปดึง HTML มาให้
        var response = UrlFetchApp.fetch("http://www.mst.ac.th/index.php", { muteHttpExceptions: true });
        return output.setContent(JSON.stringify({ 
          status: "success", 
          html: response.getContentText() 
        }));
      } catch(err) {
        return output.setContent(JSON.stringify({ 
          status: "error", 
          message: err.toString() 
        }));
      }
    }

    if (data.action === "apply") {
      let now = new Date();
      if(settings.SystemStatus === 'closed') return output.setContent(JSON.stringify({status: "error", message: "ระบบปิดรับสมัครชั่วคราว"}));
      if(settings.AppStartTime && now < new Date(settings.AppStartTime)) return output.setContent(JSON.stringify({status: "error", message: "ยังไม่ถึงเวลาเปิดรับสมัคร"}));
      if(settings.AppEndTime && now > new Date(settings.AppEndTime)) return output.setContent(JSON.stringify({status: "error", message: "หมดเขตรับสมัครแล้ว"}));

      var photoUrl = "";
      if (data.photoBase64) {
        var folders = DriveApp.getFoldersByName("Profile_Pictures_MSTSC");
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("Profile_Pictures_MSTSC");
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        var mimeType = data.photoBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,/)[1];
        var blob = Utilities.newBlob(Utilities.base64Decode(data.photoBase64.split(',')[1]), mimeType, data.studentId + "_" + data.name);
        photoUrl = folder.createFile(blob).getUrl();
      }

      var ay = settings.CurrentAcademicYear || "2569";
      var shortYear = ay.toString().slice(-2); 
      var appNumber = "";

      if (data.position === "ประธานนักเรียน") {
        var pSheet = ss.getSheetByName(SHEET_PRESIDENT);
        var prefix = "MSTSC" + shortYear + "01-";
        var pData = pSheet.getDataRange().getValues();
        var maxNum = 0;
        for(var i=1; i<pData.length; i++) {
          var existingNumStr = pData[i][1];
          if(existingNumStr && existingNumStr.toString().indexOf(prefix) === 0) {
            var numPart = parseInt(existingNumStr.toString().split('-')[1], 10);
            if(!isNaN(numPart) && numPart > maxNum) { maxNum = numPart; }
          }
        }
        var nextNum = maxNum + 1;
        var runStr = ("000" + nextNum).slice(-3);
        appNumber = prefix + runStr;

        var row = [new Date(), appNumber, ay, data.studentId, data.name, data.room, data.party, data.slogan || "-", data.policies || "-", photoUrl, "รอตรวจสอบ", ""];
        var members = data.members || [];
        for (var j = 0; j < 29; j++) {
          if (members[j]) { row.push(members[j].name); row.push(members[j].room); } else { row.push("-"); row.push("-"); }
        }
        pSheet.appendRow(row);
        
      } else {
        var cSheet = ss.getSheetByName(SHEET_COMMITTEE);
        var prefix = "MSTSC" + shortYear + "02-";
        var cData = cSheet.getDataRange().getValues();
        var maxNum = 0;
        for(var i=1; i<cData.length; i++) {
          var existingNumStr = cData[i][1];
          if(existingNumStr && existingNumStr.toString().indexOf(prefix) === 0) {
            var numPart = parseInt(existingNumStr.toString().split('-')[1], 10);
            if(!isNaN(numPart) && numPart > maxNum) { maxNum = numPart; }
          }
        }
        var nextNum = maxNum + 1;
        var runStr = ("000" + nextNum).slice(-3);
        appNumber = prefix + runStr;
        cSheet.appendRow([new Date(), appNumber, ay, data.studentId, data.name, data.room, data.party, photoUrl, "รอตรวจสอบ", ""]);
      }
      return output.setContent(JSON.stringify({ status: "success", appNumber: appNumber }));
    }

    if (data.action === "updateStatus") {
      var sheet = ss.getSheetByName(data.sheet);
      var col = data.sheet === SHEET_PRESIDENT ? 11 : 9;
      sheet.getRange(data.rowIndex, col).setValue(data.status);
      
      // ดึงรหัสและชื่อนักเรียน
      var studentIdToNotify = sheet.getRange(data.rowIndex, 4).getValue(); 
      var studentName = sheet.getRange(data.rowIndex, 5).getValue(); 
      var appNumber = sheet.getRange(data.rowIndex, 2).getValue();
      
      var notifySubject = "";
      var notifyMessage = "";

      if (data.status === "พิมพ์ใบสมัครแล้ว") {
          notifySubject = "แจ้งการพิมพ์ใบสมัครเรียบร้อยแล้ว";
          notifyMessage = `ใบสมัคร ${appNumber} ของ ${studentName} ขณะนี้คณะกรรมการได้พิมพ์ใบสมัครของท่านแล้ว กรุณาติดต่อรับเอกสารที่ห้องสภานักเรียน เพื่อนำไปดำเนินการให้สมบูรณ์และนำกลับมาส่ง`;
      } else if (data.status.indexOf("เอกสารไม่เรียบร้อย") !== -1) {
          notifySubject = "แจ้งเตือนสถานะเอกสารไม่เรียบร้อย";
          notifyMessage = `ใบสมัคร ${appNumber} ของ ${studentName} ตรวจพบข้อบกพร่องในใบสมัครของท่าน [สถานะ: ${data.status}] กรุณาติดต่อห้องสภานักเรียนโดยด่วนเพื่อดำเนินการแก้ไข`;
      } else if (data.status === "ส่งใบสมัครเรียบร้อย") {
          notifySubject = "แจ้งสถานะส่งใบสมัครสมบูรณ์";
          notifyMessage = `ใบสมัคร ${appNumber} ของ ${studentName} ขณะคณะกรรมการตรวจสอบใบสมัครของท่านเรียบร้อยแล้ว ข้อมูลถูกต้องครบถ้วน โปรดรอประกาศเปิดระบบเพื่อยืนยันสิทธิ์สัมภาษณ์`;
      }

      if (notifySubject !== "" && studentIdToNotify) {
          sendWebPushNotification([studentIdToNotify.toString()], notifySubject, notifyMessage);
      }

      return output.setContent(JSON.stringify({ status: "success" }));
    }

    // ========================================================
    // 🟢 ส่วนระบบสัมภาษณ์ (จัดการกรรมการ & ให้คะแนน)
    // ========================================================

    if (data.action === "getJudges") {
      var jData = ss.getSheetByName(SHEET_JUDGES).getDataRange().getValues();
      var judges = [];
      for (var i = 1; i < jData.length; i++) { judges.push({ name: jData[i][1], email: jData[i][2] }); }
      return output.setContent(JSON.stringify({ status: "success", judges: judges }));
    }

    if (data.action === "addJudge") {
      var jSheet = ss.getSheetByName(SHEET_JUDGES);
      if ((jSheet.getLastRow() - 1) >= 10) {
        return output.setContent(JSON.stringify({ status: "error", message: "จำกัดกรรมการสูงสุด 10 ท่าน" }));
      }
      jSheet.appendRow([new Date(), data.judgeName, data.judgeEmail]);
      return output.setContent(JSON.stringify({ status: "success", message: "เพิ่มกรรมการสำเร็จ" }));
    }

    if (data.action === "deleteJudge") {
      var jSheet = ss.getSheetByName(SHEET_JUDGES);
      var jData = jSheet.getDataRange().getValues();
      var isDeleted = false;
      
      // วนลูปจากล่างขึ้นบน เพื่อไม่ให้ Index เลื่อนเวลาใช้คำสั่ง deleteRow
      for (var i = jData.length - 1; i >= 1; i--) {
        if (jData[i][2] === data.email) {
          jSheet.deleteRow(i + 1);
          isDeleted = true;
          break; // ลบเจอแล้วให้ออกลูปทันที
        }
      }
      
      if (isDeleted) {
        return output.setContent(JSON.stringify({ status: "success" }));
      } else {
        return output.setContent(JSON.stringify({ status: "error", message: "ไม่พบข้อมูลกรรมการรายนี้ในฐานข้อมูล" }));
      }
    }

    if (data.action === "getInterviewQueue") {
      var jData = ss.getSheetByName(SHEET_JUDGES).getDataRange().getValues();
      var judgeName = "";
      for (var i = 1; i < jData.length; i++) {
        if (jData[i][2] === data.email) { judgeName = jData[i][1]; break; }
      }
      if (!judgeName) return output.setContent(JSON.stringify({ status: "error", message: "ไม่มีสิทธิ์เข้าถึง" }));

      // เช็คว่ากรรมการคนนี้เคยให้คะแนนใครไปแล้วบ้าง
      var sData = ss.getSheetByName(SHEET_SCORES).getDataRange().getValues();
      var scoredApps = [];
      for (var i = 1; i < sData.length; i++) {
        if (sData[i][2] === data.email) {
          scoredApps.push(sData[i][1]);
        }
      }

      var allEligible = [];
      
      // ดึงประธานนักเรียน มาร่วมคำนวณคิวด้วยเพื่อไม่ให้คิวข้ามหรือเหลื่อม
      var pSheet = ss.getSheetByName(SHEET_PRESIDENT);
      if (pSheet) {
        var pRows = pSheet.getDataRange().getValues();
        for (var i = 1; i < pRows.length; i++) {
          var status = pRows[i][10] ? pRows[i][10].toString().trim() : "";
          if (status === 'ยืนยันสมัครต่อ' || status === 'ผ่านการคัดเลือก' || status === 'ไม่ผ่านการคัดเลือก' || status === 'ขาดสอบ') {
            allEligible.push({ appNumber: pRows[i][1].toString(), studentId: pRows[i][3].toString(), name: pRows[i][4].toString(), room: pRows[i][5].toString(), status: status });
          }
        }
      }

      // ดึงกรรมการนักเรียน
      var cSheet = ss.getSheetByName(SHEET_COMMITTEE);
      if (cSheet) {
        var cRows = cSheet.getDataRange().getValues();
        for (var i = 1; i < cRows.length; i++) {
          var status = cRows[i][8] ? cRows[i][8].toString().trim() : "";
          if (status === 'ยืนยันสมัครต่อ' || status === 'ผ่านการคัดเลือก' || status === 'ไม่ผ่านการคัดเลือก' || status === 'ขาดสอบ') {
            allEligible.push({ appNumber: cRows[i][1].toString(), studentId: cRows[i][3].toString(), name: cRows[i][4].toString(), room: cRows[i][5].toString(), status: status });
          }
        }
      }

      // จัดกลุ่มแยกตามปีการศึกษา (เพื่อให้คิวเริ่มนับ 1 ใหม่ในแต่ละปี เหมือนในหน้าแอดมินเป๊ะๆ)
      var yearGroups = {};
      allEligible.forEach(app => {
        let match = String(app.appNumber).match(/MSTSC(\d{2})/);
        let year = match ? match[1] : "other";
        if (!yearGroups[year]) yearGroups[year] = [];
        yearGroups[year].push(app);
      });

      var queue = [];
      
      // รันเลขคิวและจัดลำดับ
      for (let year in yearGroups) {
        let apps = yearGroups[year];
        
        apps.sort((a, b) => {
          let roomA = parseInt(a.room.match(/\d+$/) || 999, 10);
          let roomB = parseInt(b.room.match(/\d+$/) || 999, 10);
          if (roomA !== roomB) return roomA - roomB;
          return a.studentId.localeCompare(b.studentId);
        });
        
        apps.forEach((app, index) => {
          app.queueNumber = index + 1; // ล็อกคิวให้เป๊ะตามแอดมิน
          
          // กรองส่งไปเฉพาะคนที่พร้อมสัมภาษณ์ และ "ยังไม่ได้ให้คะแนน"
          if (app.status === 'ยืนยันสมัครต่อ' && !scoredApps.includes(app.appNumber)) {
            queue.push({
              appNumber: app.appNumber,
              name: app.name,
              room: app.room,
              queueNumber: app.queueNumber // ส่งเลขคิวไปให้หน้าบ้านโชว์เป็น Q-XXX
            });
          }
        });
      }

      return output.setContent(JSON.stringify({ status: "success", judgeName: judgeName, queue: queue }));
    }

    if (data.action === "submitScore") {
      var sSheet = ss.getSheetByName(SHEET_SCORES);
      var s = data.scores;
      var total = s.s1 + s.s2 + s.s3 + s.s4 + s.s5 + s.s6 + s.s7;
      sSheet.appendRow([new Date(), data.appNumber, data.email, s.s1, s.s2, s.s3, s.s4, s.s5, s.s6, s.s7, total]);
      return output.setContent(JSON.stringify({ status: "success", total: total }));
    }

    if (data.action === "markAbsent") {
      let found = false;
      var cSheet = ss.getSheetByName(SHEET_COMMITTEE);
      var cData = cSheet.getDataRange().getValues();
      for(var i=1; i<cData.length; i++) {
          if(cData[i][1] === data.appNumber) {
              cSheet.getRange(i+1, 9).setValue("ขาดสอบ"); 
              found = true;
              break;
          }
      }
      
      // ถ้าไม่เจอในกรรมการ ให้ไปหาในประธานด้วย (เผื่อกดขาดสอบประธาน)
      if (!found) {
        var pSheet = ss.getSheetByName(SHEET_PRESIDENT);
        var pData = pSheet.getDataRange().getValues();
        for(var i=1; i<pData.length; i++) {
            if(pData[i][1] === data.appNumber) {
                pSheet.getRange(i+1, 11).setValue("ขาดสอบ"); 
                break;
            }
        }
      }
      
      return output.setContent(JSON.stringify({ status: "success" }));
    }

    // แทนที่บล็อกโค้ด "processFinalResults" เดิมด้วยโค้ดชุดนี้
    if (data.action === "previewFinalResults" || data.action === "processFinalResults") {
      var scoresData = ss.getSheetByName(SHEET_SCORES).getDataRange().getValues();
      var candidateScores = {};
      
      // 1. รวมคะแนนทั้งหมด
      for(var i = 1; i < scoresData.length; i++) {
         var appNum = scoresData[i][1];
         var total = parseFloat(scoresData[i][10]) || 0;
         if(!candidateScores[appNum]) candidateScores[appNum] = { sum: 0, count: 0 };
         candidateScores[appNum].sum += total;
         candidateScores[appNum].count += 1;
      }
      
      var candidates = [];
      
      // 2. ดึงผู้สมัคร "กรรมการนักเรียน" ที่มีสถานะ 'ยืนยันสมัครต่อ'
      var cSheet = ss.getSheetByName(SHEET_COMMITTEE);
      var cData = cSheet.getDataRange().getValues();
      for(var i = 1; i < cData.length; i++) {
         if(cData[i][8] === 'ยืนยันสมัครต่อ') { 
            var scoreObj = candidateScores[cData[i][1]];
            var finalScore = scoreObj ? (scoreObj.sum / scoreObj.count) : 0;
            candidates.push({ 
                sheet: SHEET_COMMITTEE, rowIndex: i + 1, 
                appNum: cData[i][1], name: cData[i][4], 
                position: 'กรรมการนักเรียน', score: finalScore 
            });
         }
      }

      // 3. ดึงผู้สมัคร "ประธานนักเรียน" ที่มีสถานะ 'ยืนยันสมัครต่อ' (ไม่รวมคนที่แต่งตั้งแล้ว)
      var pSheet = ss.getSheetByName(SHEET_PRESIDENT);
      var pData = pSheet.getDataRange().getValues();
      for(var i = 1; i < pData.length; i++) {
         if(pData[i][10] === 'ยืนยันสมัครต่อ') { 
            var scoreObj = candidateScores[pData[i][1]];
            var finalScore = scoreObj ? (scoreObj.sum / scoreObj.count) : 0;
            candidates.push({ 
                sheet: SHEET_PRESIDENT, rowIndex: i + 1, 
                appNum: pData[i][1], name: pData[i][4], 
                position: 'ประธานนักเรียน', score: finalScore 
            });
         }
      }
      
      // 4. เรียงคะแนนจากมากไปน้อย
      candidates.sort((a, b) => b.score - a.score);
      
      // ส่งข้อมูลกลับไปพรีวิวหน้าเว็บ
      if (data.action === "previewFinalResults") {
          return output.setContent(JSON.stringify({ status: "success", data: candidates }));
      }

      // สั่งอัปเดตสถานะจริงลงชีต
      if (data.action === "processFinalResults") {
          for(var i = 0; i < candidates.length; i++) {
             var status = (i < 39) ? "ผ่านการคัดเลือก" : "ไม่ผ่านการคัดเลือก";
             var targetSheet = ss.getSheetByName(candidates[i].sheet);
             var col = (candidates[i].sheet === SHEET_PRESIDENT) ? 11 : 9;
             targetSheet.getRange(candidates[i].rowIndex, col).setValue(status);
          }
          return output.setContent(JSON.stringify({ status: "success", message: "ประมวลผลคะแนน และอัปเดตสถานะเรียบร้อย" }));
      }
    }

  } catch (err) { return output.setContent(JSON.stringify({ status: "error", message: err.toString() })); }
}

function doGet(e) { return ContentService.createTextOutput("Backend System Online"); }

// ฟังก์ชันส่งแจ้งเตือน Web Push (OneSignal)
function sendWebPushNotification(studentIdArray, subject, message) {
  // ใส่ App ID ของคุณเรียบร้อยแล้ว
  const ONESIGNAL_APP_ID = "78fd7e77-e56d-49eb-abf0-b3f258597987"; 
  
  // 🔴 ไปที่เว็บ OneSignal > Settings > Keys & IDs เพื่อก๊อปปี้ REST API Key มาใส่ตรงนี้
  const ONESIGNAL_REST_API_KEY = "os_v2_app_pd6x457fnve6xk7qwpzfqwlzq5z6ze4fchmudzvxfgykvhqcs7xnyzpzgofnpy5fmjxfyfvvugf35r7ydedmeexbchs7cgcvkyfiypy";

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    target_channel: "push",
    include_aliases: {
        external_id: studentIdArray 
    },
    headings: {"en": subject, "th": subject},
    contents: {"en": message, "th": message},
    url: "https://admission-mstsc.pages.dev" 
  };

  const options = {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Basic " + ONESIGNAL_REST_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  };

  try {
    UrlFetchApp.fetch("https://onesignal.com/api/v1/notifications", options);
  } catch (e) {
    console.log("Push Error: " + e);
  }
}

// ฟังก์ชันสำหรับส่งแจ้งเตือนแบบ Broadcast (หาทุกคน)
function sendWebPushBroadcast(subject, message) {
  const ONESIGNAL_APP_ID = "78fd7e77-e56d-49eb-abf0-b3f258597987"; 
  const ONESIGNAL_REST_API_KEY = "os_v2_app_pd6x457fnve6xk7qwpzfqwlzq5z6ze4fchmudzvxfgykvhqcs7xnyzpzgofnpy5fmjxfyfvvugf35r7ydedmeexbchs7cgcvkyfiypy"; // 🔴 อย่าลืมใส่คีย์

  const payload = {
    app_id: ONESIGNAL_APP_ID,
    included_segments: ["Total Subscriptions"], // แจ้งทุกคนที่กดรับแจ้งเตือนไว้
    headings: {"en": subject, "th": subject},
    contents: {"en": message, "th": message},
    url: "https://admission-mstsc.pages.dev" 
  };

  const options = {
    method: "post",
    muteHttpExceptions: true,
    headers: {
      "Authorization": "Basic " + ONESIGNAL_REST_API_KEY,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload)
  };

  try {
    UrlFetchApp.fetch("https://onesignal.com/api/v1/notifications", options);
  } catch (e) {
    console.error("Broadcast Error: " + e.message);
  }
}

// 🟢 ฟังก์ชันหลักสำหรับเช็คเวลาและยิงแจ้งเตือนอัตโนมัติแบบเจาะจงเป้าหมาย
function runAutoNotifications() {
  var ss = SpreadsheetApp.openById(SHEET_ID); 
  var settings = getSettings(ss);
  var now = new Date();

  // 1. ฟังก์ชันดึงรหัสนักเรียนโดยคัดกรองเฉพาะ "สถานะที่ต้องการ"
  function getIdsByStatus(targetStatuses) {
    var ids = [];
    var pData = ss.getSheetByName(SHEET_PRESIDENT).getDataRange().getValues();
    for(var i=1; i<pData.length; i++) {
        var status = pData[i][10] ? pData[i][10].toString() : "";
        if(targetStatuses.some(ts => status.includes(ts))) {
            if(pData[i][3]) ids.push(pData[i][3].toString());
        }
    }
    
    var cData = ss.getSheetByName(SHEET_COMMITTEE).getDataRange().getValues();
    for(var i=1; i<cData.length; i++) {
        var status = cData[i][8] ? cData[i][8].toString() : "";
        if(targetStatuses.some(ts => status.includes(ts))) {
            if(cData[i][3]) ids.push(cData[i][3].toString());
        }
    }
    return ids;
  }

  // 2. ฟังก์ชันตรวจสอบเวลาและส่งข้อความ (🛠️ แก้ไขบัคแจ้งเตือนซ้ำแล้ว)
  function checkAndSendTargeted(settingKey, flagKey, subject, msg, targetStatuses) {
    
    // 🟢 บังคับแปลงค่าจาก Sheets ให้เป็น String (ตัวพิมพ์เล็ก) เสมอ เพื่อแก้ปัญหา Google แปลงค่าอัตโนมัติ
    var isNotified = String(settings[flagKey]).toLowerCase() === "true";

    if (settings[settingKey] && !isNotified) {
      var targetTime = new Date(settings[settingKey]);
      if (now >= targetTime) {
        
        // 🔴 ล็อกระบบทันที! เพื่อป้องกันการส่งซ้ำ
        updateSetting(ss, flagKey, "true"); 
        
        // ดึงเฉพาะรหัสนักเรียนที่สถานะตรงกับที่เราต้องการ
        var targetIds = getIdsByStatus(targetStatuses);

        // ถ้ามีคนเข้าเงื่อนไข ถึงจะยิง Push Notification แบบเจาะจงรายบุคคล
        if(targetIds.length > 0) {
           sendWebPushNotification(targetIds, subject, msg);
        }
      }
    }
  }

  // ==========================================
  // 🎯 ตั้งค่าเป้าหมายการส่งของแต่ละช่วงเวลา
  // ==========================================

  // 1. ปิดระบบรับสมัคร 
  checkAndSendTargeted(
    "AppEndTime", "Notified_AppEndTime", 
    "แจ้งปิดระบบรับสมัครสภานักเรียน", 
    "ขณะนี้หมดเวลารับสมัครแล้ว ระบบได้ปิดรับและงดรับใบสมัครเพิ่มเติม ขอขอบคุณทุกท่านที่ให้ความสนใจ", 
    ["รอตรวจสอบ", "พิมพ์ใบสมัครแล้ว", "เอกสารไม่เรียบร้อย"]
  );
  
  // 5. เปิดยืนยันสิทธิ์ 
  checkAndSendTargeted(
    "ConfirmStartTime", "Notified_ConfirmStartTime", 
    "แจ้งเปิดระบบยืนยันสิทธิ์เข้ารับการสัมภาษณ์", 
    "ระบบเปิดให้กดยืนยันสิทธิ์เข้ารับการสัมภาษณ์แล้ว กรุณาเข้าสู่ระบบเพื่อรักษาสิทธิ์ของท่าน", 
    ["ส่งใบสมัครเรียบร้อย"]
  );

  // 6. ปิดยืนยันสิทธิ์ 
  checkAndSendTargeted(
    "ConfirmEndTime", "Notified_ConfirmEndTime", 
    "แจ้งปิดระบบยืนยันสิทธิ์เข้ารับการสัมภาษณ์", 
    "ขณะนี้หมดเวลายืนยันสิทธิ์แล้ว ระบบได้ทำการปิดรับการยืนยันสิทธิ์สัมภาษณ์โดยอัตโนมัติ", 
    ["ส่งใบสมัครเรียบร้อย"]
  );

  // 7. ประกาศคิว 
  checkAndSendTargeted(
    "InterviewAnnounceTime", "Notified_InterviewAnnounceTime", 
    "ประกาศคิวและรายละเอียดการสอบสัมภาษณ์", 
    "คณะกรรมการได้จัดคิวการสอบสัมภาษณ์เรียบร้อยแล้ว กรุณาเข้าสู่ระบบเพื่อตรวจสอบเวลาและเตรียมตัวให้พร้อม", 
    ["ยืนยันสมัครต่อ"]
  );

  // 8. ประกาศผล 
  checkAndSendTargeted(
    "ResultAnnounceTime", "Notified_ResultAnnounceTime", 
    "ประกาศผลการคัดเลือกคณะกรรมการสภานักเรียน", 
    "คณะกรรมการได้ประมวลผลการคัดเลือกเสร็จสิ้นแล้ว ผู้สมัครสามารถเข้าสู่ระบบเพื่อตรวจสอบผลการคัดเลือกของท่านได้ทันที", 
    ["ผ่านการคัดเลือก", "ไม่ผ่านการคัดเลือก", "ประธานนักเรียน"]
  );
}