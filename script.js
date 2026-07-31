const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSp3Ds3ElGfNxKNYbqKwlMVEInIwK2AAi4xAsSjQBM4ZMOVx5W7bLikYjHHtpz49uaN4uP0S-FZfUx5/pub?gid=0&single=true&output=csv"; 

let examDB = []; 
let currentGrade = 3; 

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

// 통계 블록 생성 헬퍼 함수
function getStatsBlockHTML(db, title) {
    if (db.length === 0) {
        return `
            <div class="stats-block">
                <div class="stats-title">${title}</div>
                데이터가 부족합니다.
            </div>`;
    }

    let count4Grade = 0;
    let count3Grade = 0;

    db.forEach(exam => {
        const guessBaseScore = 48 + calculateGuessingScore(exam.answers, 0);
        const gradeNum = getGradeNum(guessBaseScore, exam.cuts);
        
        if (gradeNum <= 4) count4Grade++;
        if (gradeNum <= 3) count3Grade++;
    });

    const rate4 = Math.round((count4Grade / db.length) * 100);
    const rate3 = Math.round((count3Grade / db.length) * 100);

    return `
        <div class="stats-block">
            <div class="stats-title">${title}</div>
            ${db.length}개 시험 기준<br>
            4등급 달성: <span class="stats-highlight">${rate4}%</span> | 3등급 달성: <span class="stats-highlight">${rate3}%</span>
        </div>
    `;
}

// 요약 통계 대시보드 렌더링 함수
function renderStats(filteredDB) {
    const statsContainer = document.getElementById("stats-container");
    statsContainer.innerHTML = ""; // 기존 내용 초기화
    
    if (filteredDB.length === 0) {
        statsContainer.innerHTML = "<div class='stats-block'>해당 학년의 데이터가 없습니다.</div>";
        return;
    }

    let html = "";

    if (currentGrade === 3) {
        // 고3인 경우: 전체, 평가원, 수능으로 필터링하여 각각 블록 생성
        const evalDB = filteredDB.filter(exam => exam.title.endsWith("원") || exam.title.endsWith("능"));
        const suneungDB = filteredDB.filter(exam => exam.title.endsWith("능"));
        
        html += getStatsBlockHTML(filteredDB, "📊 전체 모의고사");
        html += getStatsBlockHTML(evalDB, "🎯 평가원 주관 (6월/9월/수능)");
        html += getStatsBlockHTML(suneungDB, "🔥 오직 수능만");
    } else {
        // 고1, 고2인 경우: 단일 블록
        html += getStatsBlockHTML(filteredDB, "💡 2점+3점만 모두 맞추고(48점) 찍는다면?");
    }

    statsContainer.innerHTML = html;
}

function renderTable() {
    const tbody = document.getElementById("exam-data-body");
    tbody.innerHTML = ""; 

    const filteredDB = examDB.filter(exam => exam.grade === currentGrade);
    
    renderStats(filteredDB);

    if (filteredDB.length === 0) {
        tbody.innerHTML = `<tr><td colspan="16">해당 학년의 데이터가 없습니다.</td></tr>`;
        return;
    }

    filteredDB.forEach((exam, index) => {
        const tr = document.createElement("tr");

        const guessBaseScore = 48 + calculateGuessingScore(exam.answers, 0);
        const guessBaseGradeNum = getGradeNum(guessBaseScore, exam.cuts);
        
        const rowId = index;
        const title4 = exam.title.substring(0, 4);
        let rowClass = "";

        if (title4 === "2026" || title4 === "2027") {
            rowClass += " bold-row";
        }
        
        if (exam.title.endsWith("원")) {
            rowClass += " bg-eval";
        } else if (exam.title.endsWith("능")) {
            rowClass += " bg-suneung";
        }

        tr.className = rowClass.trim();

        // 4등급 셀, 이모지 클래스(emoji-grade) 적용
        tr.innerHTML = `
            <td>${exam.title}</td>
            <td id="cut-1-${rowId}">${exam.cuts[1]}</td>
            <td id="cut-2-${rowId}">${exam.cuts[2]}</td>
            <td id="cut-3-${rowId}">${exam.cuts[3]}</td>
            <td id="cut-4-${rowId}">${exam.cuts[4]}</td>
            <td id="cut-5-${rowId}">${exam.cuts[5]}</td>
            
            <td><input type="number" min="0" max="8" value="0" id="mcq-${rowId}" onchange="updateRow(${rowId}, ${exam.grade})"></td>
            <td><input type="number" min="0" max="5" value="0" id="saq-${rowId}" onchange="updateRow(${rowId}, ${exam.grade})"></td>
            
            <td>48</td><td class="emoji-grade">${emojiGrade[getGradeNum(48, exam.cuts)]}</td>
            <td>${guessBaseScore}</td><td class="emoji-grade">${emojiGrade[guessBaseGradeNum]}</td>
            
            <td class="highlight" id="final-score-${rowId}">${guessBaseScore}</td>
            <td class="highlight emoji-grade" id="final-grade-${rowId}">${emojiGrade[guessBaseGradeNum]}</td>
            <td id="req-4-${rowId}"></td>
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

    // --- 👇 [여기서부터 새로 추가하는 로직] 👇 ---
    // 1. 해당 행의 1컷~5컷 테두리 모두 지우기 (초기화)
    for (let i = 1; i <= 5; i++) {
        const cutCell = document.getElementById(`cut-${i}-${rowId}`);
        if (cutCell) {
            cutCell.classList.remove("target-cut");
        }
    }
    // 2. 최종 등급이 1~5등급 사이라면 해당 컷 칸에 빨간 테두리 씌우기
    if (finalGradeNum >= 1 && finalGradeNum <= 5) {
        const targetCell = document.getElementById(`cut-${finalGradeNum}-${rowId}`);
        if (targetCell) {
            targetCell.classList.add("target-cut");
        }
    }
    // --- 👆 [여기까지] 👆 ---
    
    // ✅ 이모지에 emoji-grade 클래스를 적용하여 크기 확대
    const req4 = finalScore >= exam.cuts[4] ? '<span class="emoji-grade">✅</span>' : "+" + Math.ceil((exam.cuts[4] - finalScore) / 4);
    const req3 = finalScore >= exam.cuts[3] ? '<span class="emoji-grade">✅</span>' : "+" + Math.ceil((exam.cuts[3] - finalScore) / 4);
    const req2 = finalScore >= exam.cuts[2] ? '<span class="emoji-grade">✅</span>' : "+" + Math.ceil((exam.cuts[2] - finalScore) / 4);

    document.getElementById(`final-score-${rowId}`).innerText = finalScore;
    document.getElementById(`final-grade-${rowId}`).innerText = emojiGrade[finalGradeNum];
    
    // HTML 태그가 적용되도록 innerText 대신 innerHTML 사용
    document.getElementById(`req-4-${rowId}`).innerHTML = req4;
    document.getElementById(`req-3-${rowId}`).innerHTML = req3;
    document.getElementById(`req-2-${rowId}`).innerHTML = req2;
}

window.onload = loadData;
