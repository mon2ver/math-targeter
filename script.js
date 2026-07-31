const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSp3Ds3ElGfNxKNYbqKwlMVEInIwK2AAi4xAsSjQBM4ZMOVx5W7bLikYjHHtpz49uaN4uP0S-FZfUx5/pub?gid=0&single=true&output=csv"; 

let examDB = []; 
let currentGrade = 3; 

// 숫자 등급을 이모지로 변환하는 객체
const emojiGrade = {
    1: "1️⃣", 2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣", 6: "6️⃣"
};

async function loadData() {
    try {
        const response = await fetch(SHEET_CSV_URL);
        const csvText = await response.text();
        parseCSV(csvText);
        renderTable();
    } catch (error) {
        console.error("데이터 오류:", error);
    }
}

function parseCSV(csvText) {
    const rows = csvText.split(/\r?\n/);
    examDB = []; 

    for (let i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue; 
        
        const cols = rows[i].split(',');
        examDB.push({
            grade: parseInt(cols[0]),
            title: cols[1],
            cuts: {
                1: parseInt(cols[2]),
                2: parseInt(cols[3]),
                3: parseInt(cols[4]),
                4: parseInt(cols[5]),
                5: parseInt(cols[6])
            },
            answers: cols.slice(7, 28).map(Number)
        });
    }
}

function changeGrade(grade) {
    currentGrade = grade;
    renderTable();
}

// 계산용 숫자 등급 반환
function getGradeNum(score, cuts) {
    if (score >= cuts[1]) return 1;
    if (score >= cuts[2]) return 2;
    if (score >= cuts[3]) return 3;
    if (score >= cuts[4]) return 4;
    if (score >= cuts[5]) return 5;
    return 6; 
}

function calculateGuessingScore(answers, solvedMCQCount) {
    const knownCount = 13 + solvedMCQCount; 
    const counts = {1:0, 2:0, 3:0, 4:0, 5:0};
    
    for (let i = 0; i < knownCount; i++) {
        counts[answers[i]]++;
    }

    let minCount = 21;
    let candidates = [];
    for (let i = 1; i <= 5; i++) {
        if (counts[i] < minCount) {
            minCount = counts[i];
            candidates = [i]; 
        } else if (counts[i] === minCount) {
            candidates.push(i); 
        }
    }

    let minAddedScore = Infinity;
    candidates.forEach(candidate => {
        let correctGuesses = 0;
        for (let i = knownCount; i < 21; i++) {
            if (answers[i] === candidate) {
                correctGuesses++;
            }
        }
        let addedScore = correctGuesses * 4;
        if (addedScore < minAddedScore) {
            minAddedScore = addedScore;
        }
    });

    return minAddedScore;
}

// 요약 통계 대시보드 렌더링 함수
function renderStats(filteredDB) {
    const statsContainer = document.getElementById("stats-container");
    if (filteredDB.length === 0) {
        statsContainer.innerHTML = "데이터가 없습니다.";
        return;
    }

    let count4Grade = 0;
    let count3Grade = 0;

    filteredDB.forEach(exam => {
        const guessBaseScore = 48 + calculateGuessingScore(exam.answers, 0);
        const gradeNum = getGradeNum(guessBaseScore, exam.cuts);
        
        if (gradeNum <= 4) count4Grade++;
        if (gradeNum <= 3) count3Grade++;
    });

    const rate4 = Math.round((count4Grade / filteredDB.length) * 100);
    const rate3 = Math.round((count3Grade / filteredDB.length) * 100);

    statsContainer.innerHTML = `
        <div class="stats-title">💡 2점+3점만 모두 맞춰도(48점) 4점짜리를 최적의 번호로 찍는다면?</div>
        현재 ${filteredDB.length}개의 모의고사 데이터 기준<br>
        4등급 달성 확률: <span class="stats-highlight">${rate4}%</span> | 3등급 달성 확률: <span class="stats-highlight">${rate3}%</span>
    `;
}

function renderTable() {
    const tbody = document.getElementById("exam-data-body");
    tbody.innerHTML = ""; 

    const filteredDB = examDB.filter(exam => exam.grade === currentGrade);
    
    // 통계 대시보드 업데이트
    renderStats(filteredDB);

    if (filteredDB.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15">해당 학년의 데이터가 없습니다.</td></tr>`;
        return;
    }

    filteredDB.forEach((exam, index) => {
        const tr = document.createElement("tr");

        const guessBaseScore = 48 + calculateGuessingScore(exam.answers, 0);
        const guessBaseGradeNum = getGradeNum(guessBaseScore, exam.cuts);
        
        const rowId = index;
        const title4 = exam.title.substring(0, 4);
        let rowClass = "";

        // 3번 요청: 앞 네 글자가 2026 또는 2027이면 굵은 글씨
        if (title4 === "2026" || title4 === "2027") {
            rowClass += " bold-row";
        }
        
        // 4번 요청: 끝 글자 "원", "능" 배경색 처리 (줄무늬보다 우선)
        if (exam.title.endsWith("원")) {
            rowClass += " bg-eval";
        } else if (exam.title.endsWith("능")) {
            rowClass += " bg-suneung";
        }

        tr.className = rowClass.trim();

        tr.innerHTML = `
            <td>${exam.title}</td>
            <td>${exam.cuts[1]}</td><td>${exam.cuts[2]}</td><td>${exam.cuts[3]}</td><td>${exam.cuts[4]}</td><td>${exam.cuts[5]}</td>
            
            <td><input type="number" min="0" max="8" value="0" id="mcq-${rowId}" onchange="updateRow(${rowId}, ${exam.grade})"></td>
            <td><input type="number" min="0" max="5" value="0" id="saq-${rowId}" onchange="updateRow(${rowId}, ${exam.grade})"></td>
            
            <td>48</td><td>${emojiGrade[getGradeNum(48, exam.cuts)]}</td>
            <td>${guessBaseScore}</td><td>${emojiGrade[guessBaseGradeNum]}</td>
            
            <td class="highlight" id="final-score-${rowId}">${guessBaseScore}</td>
            <td class="highlight" id="final-grade-${rowId}">${emojiGrade[guessBaseGradeNum]}</td>
            <td id="req-3-${rowId}"></td>
            <td id="req-2-${rowId}"></td>
        `;
        tbody.appendChild(tr);
        
        updateRow(rowId, exam.grade);
    });
}

function updateRow(rowId, grade) {
    const filteredDB = examDB.filter(exam => exam.grade === grade);
    const exam = filteredDB[rowId];
    
    const mcqSolved = parseInt(document.getElementById(`mcq-${rowId}`).value) || 0;
    const saqSolved = parseInt(document.getElementById(`saq-${rowId}`).value) || 0;

    const finalScore = 48 + (mcqSolved * 4) + (saqSolved * 4) + calculateGuessingScore(exam.answers, mcqSolved);
    const finalGradeNum = getGradeNum(finalScore, exam.cuts);

    // 2번 요청: 달성 완료 시 ✅ 이모지 출력
    const req3 = finalScore >= exam.cuts[3] ? "✅" : "+" + Math.ceil((exam.cuts[3] - finalScore) / 4);
    const req2 = finalScore >= exam.cuts[2] ? "✅" : "+" + Math.ceil((exam.cuts[2] - finalScore) / 4);

    document.getElementById(`final-score-${rowId}`).innerText = finalScore;
    document.getElementById(`final-grade-${rowId}`).innerText = emojiGrade[finalGradeNum];
    document.getElementById(`req-3-${rowId}`).innerText = req3;
    document.getElementById(`req-2-${rowId}`).innerText = req2;
}

window.onload = loadData;