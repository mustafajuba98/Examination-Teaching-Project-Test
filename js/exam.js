document.addEventListener("DOMContentLoaded", () => {
  // --- Configuration ---
  const EXAM_DURATION_MINUTES = 20; // Total exam time in minutes

  // --- Get DOM Elements ---
  const loggedInUser = JSON.parse(sessionStorage.getItem("loggedInUser"));
  const timeDisplay = document.getElementById("time-display");
  const questionCounter = document.getElementById("question-counter");
  const questionText = document.getElementById("question-text");
  const optionsContainer = document.getElementById("options-container");
  const markReviewCheckbox = document.getElementById("mark-review-checkbox");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const finishBtn = document.getElementById("finish-btn");
  const logoutBtn = document.getElementById("logout-btn-exam");
  const reviewModalElement = document.getElementById("reviewModal");
  const reviewModal = new bootstrap.Modal(reviewModalElement);
  const reviewPanelBody = document.getElementById("review-panel-body");
  const confirmFinishBtn = document.getElementById("confirm-finish-btn");
  const examContainer = document.getElementById("exam-container");
  const examContent = document.getElementById("exam-content");
  const completionMessage = document.getElementById("completion-message");
  const examErrorMessage = document.getElementById("exam-error-message");

  // --- State Variables ---
  let questions = []; // Array to hold question objects
  let currentQuestionIndex = 0; // Index of the currently displayed question
  let userAnswers = {}; // Stores user's answers { qId: { answer: index|null, marked: bool } }
  let examTimerInterval = null; // Holds the setInterval ID for the timer
  let examStartTime = null; // Timestamp when the exam was first started
  let examEndTime = null; // Timestamp when the exam should end
  let examFinished = false; // Flag to indicate if the exam is completed or timed out

  // --- Helper Function: Escape HTML ---
  // Basic XSS prevention.
  const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string") return unsafe;
    return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // --- Helper Function: Show Error Message ---
  const showError = (message) => {
    examErrorMessage.textContent = message;
    examErrorMessage.style.display = "block";
  };

  // --- Function: Load Question ---
  // Displays the question and options for the given index.
  const loadQuestion = (index) => {
    if (index < 0 || index >= questions.length) return;

    currentQuestionIndex = index;
    localStorage.setItem("currentQuestionIndex", currentQuestionIndex);

    const question = questions[index];
    questionCounter.textContent = `Question ${index + 1} of ${
      questions.length
    }`;
    questionText.textContent = escapeHtml(question.text); // Escape question text

    optionsContainer.innerHTML = "";
    question.options.forEach((option, i) => {
      const optionId = `q${question.id}_opt${i}`;
      const answerInfo = userAnswers[question.id] || {
        answer: null,
        marked: false,
      };
      const isChecked = answerInfo.answer === i;

      const formCheckDiv = document.createElement("div");
      formCheckDiv.className = "form-check";

      const input = document.createElement("input");
      input.className = "form-check-input";
      input.type = "radio";
      input.name = `question_${question.id}`;
      input.id = optionId;
      input.value = i;
      input.checked = isChecked;
      input.addEventListener("change", handleAnswerSelection);

      const label = document.createElement("label");
      label.className = "form-check-label";
      label.htmlFor = optionId;
      label.textContent = escapeHtml(option); // Escape option text

      formCheckDiv.appendChild(input);
      formCheckDiv.appendChild(label);
      optionsContainer.appendChild(formCheckDiv);
    });

    markReviewCheckbox.checked = userAnswers[question.id]?.marked || false;
    updateNavigationButtons();
  };

  // --- Function: Save Current Answer State ---
  // Reads the current selections and updates the userAnswers object.
  const saveCurrentAnswerState = () => {
    if (examFinished || !questions || questions.length === 0) return;

    const questionId = questions[currentQuestionIndex].id;
    const selectedOptionInput = optionsContainer.querySelector(
      `input[name="question_${questionId}"]:checked`
    );
    const selectedAnswerIndex = selectedOptionInput
      ? parseInt(selectedOptionInput.value, 10)
      : null;
    const isMarked = markReviewCheckbox.checked;

    if (!userAnswers[questionId]) {
      userAnswers[questionId] = {};
    }
    userAnswers[questionId].answer = selectedAnswerIndex;
    userAnswers[questionId].marked = isMarked;

    saveAnswersToStorage();
  };

  // --- Function: Save Answers to Local Storage ---
  // Persists the userAnswers object.
  const saveAnswersToStorage = () => {
    if (examFinished) return;
    /* Security Note: Storing answers in localStorage is easily accessible/modifiable by the user. */
    localStorage.setItem("userAnswers", JSON.stringify(userAnswers));
  };

  // --- Function: Handle Answer Selection Change ---
  // Triggered when a radio button selection changes.
  const handleAnswerSelection = () => {
    saveCurrentAnswerState();
  };

  // --- Function: Update Navigation Buttons ---
  // Enables/disables Previous/Next buttons based on the current question index.
  const updateNavigationButtons = () => {
    prevBtn.disabled = currentQuestionIndex === 0;
    nextBtn.disabled = currentQuestionIndex === questions.length - 1;
  };

  // --- Function: Format Time ---
  // Converts seconds into MM:SS format.
  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // --- Function: Start Timer ---
  // Initializes and runs the countdown timer.
  const startTimer = (endTime) => {
    if (examTimerInterval) clearInterval(examTimerInterval);

    examTimerInterval = setInterval(() => {
      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.floor((endTime - now) / 1000));

      timeDisplay.textContent = formatTime(remainingSeconds);

      if (remainingSeconds <= 0) {
        clearInterval(examTimerInterval);
        submitExam(true); // Auto-submit on timeout
      }

      // Visual cue for low time
      if (
        remainingSeconds <= 300 &&
        !timeDisplay.classList.contains("text-danger")
      ) {
        timeDisplay.classList.add("text-danger");
      } else if (
        remainingSeconds > 300 &&
        timeDisplay.classList.contains("text-danger")
      ) {
        timeDisplay.classList.remove("text-danger");
      }
    }, 1000);
  };

  // --- Function: Populate Review Panel ---
  // Generates the content for the review modal.
  const populateReviewPanel = () => {
    reviewPanelBody.innerHTML = ""; // Clear previous content

    const instructions = document.createElement("p");
    instructions.textContent =
      "Click on a question number to review it. Marked questions have a yellow border. Answered questions have a green background.";
    reviewPanelBody.appendChild(instructions);
    reviewPanelBody.appendChild(document.createElement("hr"));

    questions.forEach((q, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = index + 1;
      item.className = "review-panel-item btn";
      item.setAttribute("data-question-index", index);

      const answerInfo = userAnswers[q.id];
      if (answerInfo?.answer !== null) item.classList.add("answered");
      if (answerInfo?.marked) item.classList.add("marked");
      if (index === currentQuestionIndex) {
        item.classList.add("current", "btn-outline-primary");
      } else {
        item.classList.add("btn-outline-secondary");
      }

      item.addEventListener("click", () => {
        goToQuestion(index);
        reviewModal.hide();
      });
      reviewPanelBody.appendChild(item);
    });
  };

  // --- Function: Go To Question ---
  // Navigates to a specific question index.
  const goToQuestion = (index) => {
    if (examFinished || index < 0 || index >= questions.length) return;
    saveCurrentAnswerState(); // Save state before leaving
    loadQuestion(index);
  };

  // --- Function: Clear Exam Local Storage ---
  // Removes exam-specific progress data after submission/logout.
  const clearExamLocalStorage = () => {
    localStorage.removeItem("userAnswers");
    localStorage.removeItem("currentQuestionIndex");
    localStorage.removeItem("examStartTime");
  };

  // --- Function: Disable Exam Controls ---
  // Hides the main exam interface after completion.
  const disableExamControls = () => {
    if (examContent) examContent.style.display = "none";
    if (timeDisplay) timeDisplay.textContent = "00:00";
    // Consider disabling logout button too, or handle logout differently post-exam
  };

  // --- Function: Submit Exam ---
  // Finalizes the exam, calculates score (demo only), displays results, and cleans up.
  const submitExam = (isTimeout = false) => {
    if (examFinished) return;
    examFinished = true;
    clearInterval(examTimerInterval);
    saveCurrentAnswerState(); // Save the very last state

    // --- Score Calculation (DEMO ONLY - INSECURE) ---
    /*
     * WARNING: Calculating score client-side using answers stored
     * in localStorage (where correct answers might also be accessible)
     * is highly insecure and easily manipulated.
     * A real system MUST calculate scores server-side.
     */
    let correctCount = 0;
    questions.forEach((q) => {
      const userAnswerIndex = userAnswers[q.id]?.answer;
      // Assumes 'correctAnswer' property exists on question objects (loaded from insecure localStorage)
      if (userAnswerIndex !== null && userAnswerIndex === q.correctAnswer) {
        correctCount++;
      }
    });
    const score =
      questions.length > 0
        ? ((correctCount / questions.length) * 100).toFixed(2)
        : 0;

    // --- Display Completion Message ---
    let message = "";
    let messageClass = "alert ";
    if (isTimeout) {
      message = `Time's Up! Exam automatically submitted. Your score: ${score}% (${correctCount}/${questions.length})`;
      messageClass += "alert-warning";
    } else {
      message = `Exam Finished! Thank you for participating. Your score: ${score}% (${correctCount}/${questions.length})`;
      messageClass += "alert-success";
    }
    completionMessage.className = `text-center h3 mt-5 ${messageClass}`; // Apply classes
    completionMessage.textContent = message;
    completionMessage.style.display = "block";

    // --- Clean Up ---
    disableExamControls();
    clearExamLocalStorage();

    console.log("Exam Submitted. Final Answers:", userAnswers); // For debugging
    console.log(
      `Score (Client-Side Demo): ${score}% (${correctCount}/${questions.length})`
    );
  };

  // --- Function: Handle Logout ---
  // Clears session/storage and redirects to login.
  const handleLogout = () => {
    if (examTimerInterval) clearInterval(examTimerInterval);
    sessionStorage.removeItem("loggedInUser");
    clearExamLocalStorage(); // Clear exam progress on logout
    window.location.href = "index.html";
  };

  // --- Function: Initialize Exam ---
  // Sets up the exam page on load.
  const initializeExam = () => {
    examErrorMessage.textContent = ""; // Clear errors on init

    // Authentication Check
    if (!loggedInUser || loggedInUser.isAdmin) {
      alert("Unauthorized access or invalid user type. Redirecting to login.");
      window.location.href = "index.html";
      return;
    }

    // Load Questions
    /* Security Note: Loading questions including correct answers into the client is insecure. */
    const storedQuestions = JSON.parse(localStorage.getItem("questions")) || [];
    if (storedQuestions.length === 0) {
      showError(
        "No questions found for this exam. Please contact the administrator."
      );
      disableExamControls();
      return;
    }
    questions = storedQuestions;

    // Load User State (Resume)
    const savedAnswers = JSON.parse(localStorage.getItem("userAnswers"));
    const savedIndex = localStorage.getItem("currentQuestionIndex");
    const savedStartTime = localStorage.getItem("examStartTime");

    userAnswers = savedAnswers || {};
    // Ensure structure exists for all questions even if starting fresh or resuming partially
    questions.forEach((q) => {
      if (!userAnswers[q.id]) {
        userAnswers[q.id] = { answer: null, marked: false };
      }
    });
    // Save potentially updated structure back immediately if needed for consistency
    // saveAnswersToStorage(); // Optional: uncomment if initial structure save is desired

    currentQuestionIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
    if (
      isNaN(currentQuestionIndex) ||
      currentQuestionIndex >= questions.length ||
      currentQuestionIndex < 0
    ) {
      currentQuestionIndex = 0;
    }

    // Initialize Timer
    const now = Date.now();
    if (savedStartTime) {
      examStartTime = parseInt(savedStartTime, 10);
      examEndTime = examStartTime + EXAM_DURATION_MINUTES * 60 * 1000;

      if (now >= examEndTime) {
        submitExam(true); // Already timed out
        return;
      } else {
        startTimer(examEndTime); // Resume timer
      }
    } else {
      examStartTime = now;
      examEndTime = examStartTime + EXAM_DURATION_MINUTES * 60 * 1000;
      localStorage.setItem("examStartTime", examStartTime);
      startTimer(examEndTime); // Start timer
    }

    // Load Initial Question
    loadQuestion(currentQuestionIndex);
  };

  // --- Event Listeners ---
  prevBtn.addEventListener("click", () =>
    goToQuestion(currentQuestionIndex - 1)
  );
  nextBtn.addEventListener("click", () =>
    goToQuestion(currentQuestionIndex + 1)
  );
  markReviewCheckbox.addEventListener("change", saveCurrentAnswerState); // Save state when marked
  logoutBtn.addEventListener("click", handleLogout);

  finishBtn.addEventListener("click", () => {
    saveCurrentAnswerState(); // Ensure latest state is saved
    populateReviewPanel();
    reviewModal.show();
  });

  confirmFinishBtn.addEventListener("click", () => {
    reviewModal.hide();
    // Add confirmation dialog
    if (confirm("Are you sure you want to finish the exam?")) {
      submitExam();
    }
  });

  // --- Start Exam Initialization ---
  initializeExam();
});
