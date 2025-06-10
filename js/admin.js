
document.addEventListener("DOMContentLoaded", () => {
    
  const loggedInUser = JSON.parse(sessionStorage.getItem("loggedInUser"));
  const questionsTableBody = document.getElementById("questions-table-body");
  const questionModalElement = document.getElementById("questionModal");
  const questionModal = new bootstrap.Modal(questionModalElement);
  const questionForm = document.getElementById("question-form");
  const questionModalLabel = document.getElementById("questionModalLabel");
  const questionIdInput = document.getElementById("question-id");
  const questionTextInput = document.getElementById("question-text");
  const optionsContainer = document.getElementById("options-container");
  const saveQuestionBtn = document.getElementById("save-question-btn");
  const addQuestionBtn = document.getElementById("add-question-btn");
  const modalErrorMessage = document.getElementById("modal-error-message");
  const logoutBtn = document.getElementById("logout-btn");

  // --- Configuration ---
  const minOptions = 2; // Minimum required options per question

  // --- Authentication Check ---
  // Redirects to login if user is not logged in or not an admin.
  if (!loggedInUser || !loggedInUser.isAdmin) {
    alert("Unauthorized access. Redirecting to login page.");
    window.location.href = "index.html";
    return;
  }

  // --- Logout Functionality ---
  // Handles clearing session and redirecting on logout button click.
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("loggedInUser");
      localStorage.removeItem("userAnswers"); // Clear potential leftover exam data
      localStorage.removeItem("examStartTime");
      localStorage.removeItem("currentQuestionIndex");
      window.location.href = "index.html";
    });
  }

  // --- Helper Function: Escape HTML ---
  // Basic XSS prevention for displaying dynamic text in HTML.
  const escapeHtml = (unsafe) => {
    if (typeof unsafe !== "string") return unsafe;
    return unsafe
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  // --- Function: Load and Display Questions ---
  // Fetches questions from localStorage and populates the admin table.
  const loadQuestions = () => {
    const questions = JSON.parse(localStorage.getItem("questions")) || [];
    questionsTableBody.innerHTML = "";

    if (questions.length === 0) {
      questionsTableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">No questions available yet.</td></tr>';
      return;
    }

    questions.forEach((q, index) => {
      const row = document.createElement("tr");
      row.setAttribute("data-id", q.id);

      const displayedOptions = q.options
        .map(
          (opt, i) =>
            `<span class="${
              i === q.correctAnswer ? "fw-bold text-success" : ""
            }">${i + 1}. ${
              opt.length > 20
                ? escapeHtml(opt.substring(0, 17)) + "..."
                : escapeHtml(opt)
            }</span>`
        )
        .join("<br>");

      const correctAnswerText =
        q.options && q.correctAnswer < q.options.length
          ? escapeHtml(q.options[q.correctAnswer])
          : "Not Set";

      row.innerHTML = `
                <th scope="row">${index + 1}</th>
                <td>${
                  q.text.length > 50
                    ? escapeHtml(q.text.substring(0, 47)) + "..."
                    : escapeHtml(q.text)
                }</td>
                <td>${displayedOptions}</td>
                <td class="text-success fw-bold">${correctAnswerText}</td>
                <td>
                    <button class="btn btn-sm btn-warning me-1 edit-btn" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      questionsTableBody.appendChild(row);
    });
  };

  // --- Function: Update Remove Button States ---
  // Enables/disables the "Remove Option" buttons based on the current count.
  const updateRemoveButtonStates = () => {
    const removeButtons =
      optionsContainer.querySelectorAll(".remove-option-btn");
    const disableRemove = removeButtons.length <= minOptions;
    removeButtons.forEach((btn) => (btn.disabled = disableRemove));
  };

  // --- Function: Renumber Options ---
  // Updates placeholders and radio button values after an option is removed.
  const renumberOptions = () => {
    optionsContainer
      .querySelectorAll(".option-group")
      .forEach((group, index) => {
        group.querySelector(".correct-answer-radio").value = index;
        group.querySelector(".option-input").placeholder = `Option ${
          index + 1
        }`;
      });
  };

  // --- Function: Handle Removing an Option ---
  // Attached to remove buttons; removes the option group if allowed.
  const handleRemoveOption = (event) => {
    const optionGroup = event.target.closest(".option-group");
    if (
      optionsContainer.querySelectorAll(".option-group").length > minOptions
    ) {
      const wasChecked = optionGroup.querySelector(
        ".correct-answer-radio"
      ).checked;
      optionGroup.remove();
      renumberOptions();
      updateRemoveButtonStates();

      if (wasChecked) {
        const anyRadioChecked = optionsContainer.querySelector(
          ".correct-answer-radio:checked"
        );
        if (!anyRadioChecked) {
          // Optionally auto-check the first one or leave all unchecked
        }
      }
    } else {
      alert(`A minimum of ${minOptions} options is required.`);
    }
  };

  // --- Function: Render Options Inputs in Modal ---
  // Creates the HTML for option input fields within the modal.
  const renderOptionsInputs = (options = [], correctAnswerIndex = null) => {
    optionsContainer.innerHTML = "";
    let currentOptions = options.length > 0 ? options : ["", "", "", ""]; // Default 4 options

    if (options.length > 0 && options.length < minOptions) {
      for (let i = options.length; i < minOptions; i++) {
        currentOptions.push("");
      }
    }

    currentOptions.forEach((optionText, index) => {
      const isChecked = index === correctAnswerIndex;
      const div = document.createElement("div");
      div.classList.add("input-group", "mb-3", "option-group");
      div.innerHTML = `
                <div class="input-group-text">
                    <input class="form-check-input mt-0 correct-answer-radio" type="radio" value="${index}" name="correctAnswer" aria-label="Mark as correct answer" ${
        isChecked ? "checked" : ""
      } required>
                </div>
                <input type="text" class="form-control option-input" placeholder="Option ${
                  index + 1
                }" value="${escapeHtml(optionText)}" required>
                <button class="btn btn-outline-danger remove-option-btn" type="button" title="Remove Option">
                    <i class="fas fa-times"></i>
                </button>
            `;
      optionsContainer.appendChild(div);
    });

    optionsContainer.querySelectorAll(".remove-option-btn").forEach((btn) => {
      btn.addEventListener("click", handleRemoveOption);
    });
    updateRemoveButtonStates();
  };

  // --- Function: Prepare Modal for Adding ---
  // Resets the modal form for adding a new question.
  const prepareModalForAdd = () => {
    questionModalLabel.textContent = "Add New Question";
    questionForm.reset();
    questionIdInput.value = "";
    modalErrorMessage.textContent = "";
    renderOptionsInputs([]); // Render default empty options
    saveQuestionBtn.textContent = "Save Question";
  };

  // --- Event Listener: Add Question Button ---
  // Opens the modal in 'add' mode.
  if (addQuestionBtn) {
    addQuestionBtn.addEventListener("click", prepareModalForAdd);
  }

  //  adding and editing questions.
  questionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    modalErrorMessage.textContent = "";

    const id = questionIdInput.value;
    const text = questionTextInput.value.trim();
    const optionInputs = optionsContainer.querySelectorAll(".option-input");
    const options = Array.from(optionInputs).map((input) => input.value.trim());
    const correctAnswerRadio = optionsContainer.querySelector(
      'input[name="correctAnswer"]:checked'
    );

    // Validation
    if (!text) {
      modalErrorMessage.textContent = "Please enter the question text.";
      questionTextInput.focus();
      return;
    }
    if (options.some((opt) => !opt)) {
      modalErrorMessage.textContent = "Please fill in all option fields.";
      const firstEmpty = Array.from(optionInputs).find(
        (input) => !input.value.trim()
      );
      if (firstEmpty) firstEmpty.focus();
      return;
    }
    if (!correctAnswerRadio) {
      modalErrorMessage.textContent = "Please select the correct answer.";
      const firstRadio = optionsContainer.querySelector(
        ".correct-answer-radio"
      );
      if (firstRadio) firstRadio.focus();
      return;
    }

    const correctAnswerIndex = parseInt(correctAnswerRadio.value, 10);
    const questions = JSON.parse(localStorage.getItem("questions")) || [];
    const newQuestion = {
      id: id || `q${Date.now()}`,
      text: text,
      options: options,
      correctAnswer: correctAnswerIndex,
    };

    if (id) {
      // Editing
      const questionIndex = questions.findIndex((q) => q.id === id);
      if (questionIndex > -1) {
        questions[questionIndex] = newQuestion;
      } else {
        alert("Error: Could not find the question to update.");
        return;
      }
    } else {
      questions.push(newQuestion);
    }

    localStorage.setItem("questions", JSON.stringify(questions));
    loadQuestions();
    questionModal.hide();
  });

  // --- Event Delegation: Edit and Delete Buttons ---
  // Uses event delegation on the table body for handling clicks.
  questionsTableBody.addEventListener("click", (event) => {
    const target = event.target;
    const row = target.closest("tr");
    if (!row || !row.dataset.id) return;

    const questionId = row.dataset.id;

    if (target.closest(".edit-btn")) {
      // Edit action
      modalErrorMessage.textContent = "";
      const questions = JSON.parse(localStorage.getItem("questions")) || [];
      const questionToEdit = questions.find((q) => q.id === questionId);

      if (questionToEdit) {
        questionModalLabel.textContent = "Edit Question";
        questionIdInput.value = questionToEdit.id;
        questionTextInput.value = questionToEdit.text;
        renderOptionsInputs(
          questionToEdit.options,
          questionToEdit.correctAnswer
        );
        saveQuestionBtn.textContent = "Update Question";
        questionModal.show();
      } else {
        alert("Error: Question data not found.");
      }
    } else if (target.closest(".delete-btn")) {
      // Delete action
      if (
        confirm(
          "Are you sure you want to delete this question? This action cannot be undone."
        )
      ) {
        let questions = JSON.parse(localStorage.getItem("questions")) || [];
        questions = questions.filter((q) => q.id !== questionId);
        localStorage.setItem("questions", JSON.stringify(questions));
        loadQuestions();
      }
    }
  });

  // --- Event Listener: Modal Close ---
  // Clears error messages when the modal is hidden.
  questionModalElement.addEventListener("hidden.bs.modal", (event) => {
    modalErrorMessage.textContent = "";
  });

  // --- Initial Load ---
  // Loads existing questions when the page loads.
  loadQuestions();
});
