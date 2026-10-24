
// ============================================
// TASKFORGE — JAVASCRIPT
// ============================================

// 1. SELECT HTML ELEMENTS

const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const taskCategory = document.getElementById("task-category");
const taskPriority = document.getElementById("task-priority");
const taskSearch = document.getElementById("task-search");
const clearSearchButton = document.getElementById("clear-search");
const taskDueDate = document.getElementById("task-due-date");

const overdueCountDisplay = document.getElementById("overdue-count");
const dueTodayCountDisplay = document.getElementById("due-today-count");
const upcomingCountDisplay = document.getElementById("upcoming-count");
const reminderMessage = document.getElementById("reminder-message");

const totalTasksDisplay = document.getElementById("total-tasks");
const completedTasksDisplay = document.getElementById("completed-tasks");
const remainingTasksDisplay = document.getElementById("remaining-tasks");
const completionRateDisplay = document.getElementById("completion-rate");

const taskCountDisplay = document.getElementById("task-count");
const emptyState = document.getElementById("empty-state");

// Status filter buttons
const filterButtons = document.querySelectorAll(".filter-btn");

// Priority filter dropdown
const priorityFilter = document.getElementById("priority-filter");

let currentFilter = "all";
let currentPriorityFilter = "all";
let currentSearchQuery = "";



// ============================================
// 2. APPLICATION DATA
// ============================================

let tasks = [];
let taskStorageMode = "guest";
let tasksReady = false;


// ============================================
// TASKFORGE — CLOUD TASK LOADING
// ============================================

function databaseTaskToAppTask(task) {
    return {
        id: String(task.id),
        cloudId: task.id,
        text: task.title,
        category: task.category.charAt(0).toUpperCase()
            + task.category.slice(1),
        priority: task.priority.charAt(0).toUpperCase()
            + task.priority.slice(1),
        dueDate: task.due_date || "",
        completed: task.completed
    };
}

async function loadCloudTasks() {
    const user = window.taskForgeAuth?.user;

    if (!user) {
        console.warn("No authenticated user. Cloud loading cancelled.");
        return;
    }

    taskStorageMode = "cloud";
    tasksReady = false;
    tasks = [];
    renderTasks();

    try {
        const { data, error } = await supabaseClient
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

        if (error) {
            throw error;
        }

        tasks = data.map(databaseTaskToAppTask);
        tasksReady = true;

        renderTasks();

        console.log("TaskForge cloud tasks loaded:", tasks.length);
    } catch (error) {
        console.error("Could not load cloud tasks:", error);

        alert(
            "We couldn't load your cloud tasks. " +
            "Please check your connection and try again."
        );
    }
}


function loadGuestTasks() {
    try {
        const savedTasks = localStorage.getItem("taskforge-guest-tasks");

        if (!savedTasks) {
            tasks = [];
            return;
        }

        const parsedTasks = JSON.parse(savedTasks);

        if (Array.isArray(parsedTasks)) {
            tasks = parsedTasks.filter(task =>
                task &&
                typeof task.id === "string" &&
                typeof task.text === "string" &&
                typeof task.completed === "boolean"
            );
        } else {
            tasks = [];
        }
    } catch (error) {
        console.error("Could not load guest tasks:", error);
        tasks = [];
    }
}

loadGuestTasks();



// ============================================
// 3. SAVE TASKS
// ============================================

function saveTasks() {
    // Cloud mode will use Supabase instead of guest storage.
    if (taskStorageMode === "cloud") {
        return;
    }

    try {
       localStorage.setItem(
    "taskforge-guest-tasks",
    JSON.stringify(tasks)
); 
    } catch (error) {
        console.error("Could not save guest tasks:", error);
        alert("Your changes could not be saved in this browser.");
    }
}



// ============================================
// 4. UPDATE STATISTICS
// ============================================

function updateStatistics() {
    const total = tasks.length;

    const completed = tasks.filter(
        task => task.completed
    ).length;

    const remaining = total - completed;

    const rate = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    totalTasksDisplay.textContent = total;
    completedTasksDisplay.textContent = completed;
    remainingTasksDisplay.textContent = remaining;
    completionRateDisplay.textContent = `${rate}%`;

    const visibleCount = getVisibleTasks().length;

    taskCountDisplay.textContent =
        `${visibleCount} ${visibleCount === 1 ? "task" : "tasks"}`;

    emptyState.classList.toggle("hidden", visibleCount > 0);
}


// ============================================
// 5. SMART REMINDERS
// ============================================

function updateSmartReminders() {
    const now = new Date();

    // Get today's date at midnight.
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    let overdueCount = 0;
    let dueTodayCount = 0;
    let upcomingCount = 0;

    // Examine all tasks, regardless of active filters.
    tasks.forEach(task => {
        // Ignore completed tasks and tasks without deadlines.
        if (task.completed || !task.dueDate) {
            return;
        }

        // Parse the deadline as a local calendar date.
        const [year, month, day] = task.dueDate
            .split("-")
            .map(Number);

        const deadline = new Date(year, month - 1, day);

        // Ignore invalid dates.
        if (
            Number.isNaN(deadline.getTime()) ||
            deadline.getFullYear() !== year ||
            deadline.getMonth() !== month - 1 ||
            deadline.getDate() !== day
        ) {
            return;
        }

        if (deadline < today) {
            overdueCount++;
        } else if (deadline.getTime() === today.getTime()) {
            dueTodayCount++;
        } else {
            upcomingCount++;
        }
    });

    // Update the reminder counters.
    overdueCountDisplay.textContent = overdueCount;
    dueTodayCountDisplay.textContent = dueTodayCount;
    upcomingCountDisplay.textContent = upcomingCount;

    // Display the most relevant reminder message.
    if (overdueCount > 0) {
        reminderMessage.textContent =
            `You have ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}. ` +
            "Prioritize these to get back on track.";
    } else if (dueTodayCount > 0) {
        reminderMessage.textContent =
            `You have ${dueTodayCount} task${dueTodayCount === 1 ? "" : "s"} due today. ` +
            "Focus on completing them before the day ends.";
    } else if (upcomingCount > 0) {
        reminderMessage.textContent =
            `You have ${upcomingCount} upcoming deadline${upcomingCount === 1 ? "" : "s"}. ` +
            "Plan ahead and stay consistent!";
    } else {
        reminderMessage.textContent =
            "You're all caught up! Keep up the good work.";
    }
}


// ============================================
// 6. FILTER TASKS
// ============================================

function getVisibleTasks() {
    let filteredTasks = tasks;

    // Filter by task status.
    if (currentFilter === "active") {
        filteredTasks = filteredTasks.filter(
            task => !task.completed
        );
    } else if (currentFilter === "completed") {
        filteredTasks = filteredTasks.filter(
            task => task.completed
        );
    }

    // Filter by priority.
    if (currentPriorityFilter !== "all") {
        filteredTasks = filteredTasks.filter(task => {
            const priority = task.priority || "Medium";

            return priority === currentPriorityFilter;
        });
    }

    // Search task descriptions without case sensitivity.
    if (currentSearchQuery !== "") {
        const query = currentSearchQuery.toLowerCase();

        filteredTasks = filteredTasks.filter(task =>
            task.text.toLowerCase().includes(query)
        );
    }

    return filteredTasks;
}


// ============================================
// 7. DISPLAY TASKS
// ============================================

function renderTasks() {
    taskList.replaceChildren();

    const visibleTasks = getVisibleTasks();

    visibleTasks.forEach(task => {
        const listItem = document.createElement("li");

        listItem.className = "task-item";

        if (task.completed) {
            listItem.classList.add("completed");
        }

        // Create the checkbox.
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.className = "task-checkbox";
        checkbox.checked = task.completed;

        checkbox.setAttribute(
            "aria-label",
            `Mark ${task.text} as completed`
        );

        checkbox.addEventListener("change", () => {
            toggleTask(task.id);
        });

        // Create the task text.
        const taskText = document.createElement("span");

        taskText.className = "task-text";
        taskText.textContent = task.text;

        // Create the category badge.
        const categoryBadge = document.createElement("span");

        categoryBadge.className = "task-category-badge";
        categoryBadge.textContent = task.category || "Personal";

        // Create the priority badge.
        const priorityBadge = document.createElement("span");

        const priority = task.priority || "Medium";

        priorityBadge.className = "priority-badge";

        if (priority === "High") {
            priorityBadge.classList.add("priority-high");
        } else if (priority === "Low") {
            priorityBadge.classList.add("priority-low");
        } else {
            priorityBadge.classList.add("priority-medium");
        }

        priorityBadge.textContent = `${priority} Priority`;

        // Create the deadline display if a due date exists.
        let dueDateContainer = null;

        if (task.dueDate) {
            const [year, month, day] = task.dueDate
                .split("-")
                .map(Number);

            const dueDate = new Date(year, month - 1, day);

            // Check that the saved date is valid.
            const validDate =
                !Number.isNaN(dueDate.getTime()) &&
                dueDate.getFullYear() === year &&
                dueDate.getMonth() === month - 1 &&
                dueDate.getDate() === day;

            if (validDate) {
                dueDateContainer = document.createElement("div");

                dueDateContainer.className = "task-due-date";

                const dateLabel = document.createElement("span");

                dateLabel.textContent =
                    `📅 Due ${dueDate.toLocaleDateString(
                        undefined,
                        {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                        }
                    )}`;

                dueDateContainer.appendChild(dateLabel);

                // Compare calendar dates.
                const now = new Date();

                const today = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );

                let badgeText = "";
                let badgeClass = "";

                if (task.completed) {
                    badgeText = "COMPLETED";
                    badgeClass = "due-completed";
                } else if (dueDate < today) {
                    badgeText = "OVERDUE";
                    badgeClass = "due-overdue";
                } else if (dueDate.getTime() === today.getTime()) {
                    badgeText = "DUE TODAY";
                    badgeClass = "due-today";
                } else {
                    badgeText = "UPCOMING";
                    badgeClass = "due-upcoming";
                }

                const dueDateBadge = document.createElement("span");

                dueDateBadge.className =
                    `due-date-badge ${badgeClass}`;

                dueDateBadge.textContent = badgeText;

                dueDateContainer.appendChild(dueDateBadge);
            }
        }

        // Create the delete button.
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.textContent = "Delete";

        deleteButton.setAttribute(
            "aria-label",
            `Delete task: ${task.text}`
        );

        deleteButton.addEventListener("click", () => {
            deleteTask(task.id);
        });

        // Add elements to the task item.
        listItem.append(
            checkbox,
            taskText,
            categoryBadge,
            priorityBadge
        );

        if (dueDateContainer) {
            listItem.appendChild(dueDateContainer);
        }

        listItem.appendChild(deleteButton);

        // Add the task item to the task list.
        taskList.appendChild(listItem);
    });

    // Refresh all dashboard data after every task change.
        updateStatistics();
        updateSmartReminders();
        updatePlanner();
        updateInsights();

    }


// ============================================
// 8. ADD A NEW TASK
// ============================================

async function addTask(event) {
    event.preventDefault();

    const taskText = taskInput.value.trim();

    if (taskText === "") {
        taskInput.focus();
        return;
    }

    if (taskStorageMode === "cloud" && !window.taskForgeAuth?.user) {
        alert("Your session is unavailable. Please sign in again.");
        return;
    }

    const newTask = {
        id: crypto.randomUUID
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2),
        text: taskText,
        category: taskCategory.value,
        priority: taskPriority.value,
        dueDate: taskDueDate.value,
        completed: false
    };

    // CLOUD MODE: save the task to Supabase first.
    if (taskStorageMode === "cloud") {
        const user = window.taskForgeAuth.user;

        const cloudTask = {
            user_id: user.id,
            title: newTask.text,
            category: newTask.category.toLowerCase(),
            priority: newTask.priority.toLowerCase(),
            due_date: newTask.dueDate || null,
            completed: false
        };

        const submitButton = taskForm.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            const { data, error } = await supabaseClient
                .from("tasks")
                .insert(cloudTask)
                .select()
                .single();

            if (error) {
                throw error;
            }

            const savedTask = databaseTaskToAppTask(data);

            tasks.unshift(savedTask);
            renderTasks();

            taskInput.value = "";
            taskDueDate.value = "";
            taskInput.focus();

            console.log("Task saved to Supabase:", savedTask.text);
        } catch (error) {
            console.error("Could not save cloud task:", error);

            alert(
                "Your task could not be saved to the cloud. " +
                "Please check your connection and try again."
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }

        return;
    }

    // GUEST MODE: preserve existing local storage behavior.
    tasks.unshift(newTask);

    saveTasks();
    renderTasks();

    taskInput.value = "";
    taskDueDate.value = "";
    taskInput.focus();
}


// Listen for form submission.
taskForm.addEventListener("submit", addTask);

// ============================================
// 9. COMPLETE OR UNCOMPLETE A TASK
// ============================================

async function toggleTask(taskId) {
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    const newCompletedStatus = !task.completed;

    if (taskStorageMode === "cloud") {
        const user = window.taskForgeAuth?.user;

        if (!user || !task.cloudId) {
            console.error("User session or cloud task ID is missing.");
            alert("Your session may have expired. Please sign in again.");
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from("tasks")
                .update({ completed: newCompletedStatus })
                .eq("id", task.cloudId)
                .eq("user_id", user.id)
                .select("id");

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("No task was updated.");
            }
        } catch (error) {
            console.error("Could not update cloud task:", error);
            alert("Could not update your task. Please try again.");
            renderTasks();
            return;
        }
    }

    tasks = tasks.map(item =>
        item.id === taskId
            ? { ...item, completed: newCompletedStatus }
            : item
    );

    saveTasks();
    renderTasks();
}




// ============================================
// 10. DELETE A TASK
// ============================================

async function deleteTask(taskId) {
    const task = tasks.find(item => item.id === taskId);

    if (!task) return;

    if (taskStorageMode === "cloud") {
        const user = window.taskForgeAuth?.user;

        if (!user || !task.cloudId) {
            console.error("User session or cloud task ID is missing.");
            alert("Your session may have expired. Please sign in again.");
            return;
        }

        try {
            const { data, error } = await supabaseClient
                .from("tasks")
                .delete()
                .eq("id", task.cloudId)
                .eq("user_id", user.id)
                .select("id");

            if (error) throw error;

            if (!data || data.length === 0) {
                throw new Error("No task was deleted.");
            }
        } catch (error) {
            console.error("Could not delete cloud task:", error);
            alert("Could not delete your task. Please try again.");
            return;
        }
    }

    tasks = tasks.filter(item => item.id !== taskId);

    saveTasks();
    renderTasks();
}



// ============================================
// 11. CHANGE THE TASK STATUS FILTER
// ============================================

filterButtons.forEach(button => {
    button.addEventListener("click", () => {
        currentFilter = button.dataset.filter;

        filterButtons.forEach(filterButton => {
            const isActive = filterButton === button;

            filterButton.classList.toggle("active", isActive);

            filterButton.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });

        renderTasks();
    });
});


// ============================================
// 12. PRIORITY FILTER BUTTONS
// ============================================

if (priorityFilter) {
    priorityFilter.addEventListener("change", () => {
        currentPriorityFilter = priorityFilter.value;
        renderTasks();
    });
}


// ============================================
// 13. TASK SEARCH
// ============================================

// Search tasks as the user types.
taskSearch.addEventListener("input", () => {
    currentSearchQuery = taskSearch.value.trim();

    clearSearchButton.hidden = currentSearchQuery === "";

    renderTasks();
});


// Clear the search field.
clearSearchButton.addEventListener("click", () => {
    taskSearch.value = "";
    currentSearchQuery = "";

    clearSearchButton.hidden = true;

    taskSearch.focus();

    renderTasks();
});


// ============================================
// 14. START THE APPLICATION
// ============================================

// Set the initial status filter button states.
filterButtons.forEach(button => {
    button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === currentFilter)
    );
});


// Set the initial priority filter dropdown.
if (priorityFilter) {
    priorityFilter.value = currentPriorityFilter;
}

// Display saved tasks and calculate initial statistics.
renderTasks();

/* ==========================================
TASKFORGE — FOUR-SCREEN NAVIGATION
========================================== */

const screenTitles = {
home: "Welcome back!",
tasks: "My Tasks",
planner: "Planner",
insights: "Insights",
account: "My Account"
};

function showScreen(screenName) {
const targetScreen = document.getElementById(
`screen-${screenName}`
);


if (!targetScreen) {
    console.error(`TaskForge: Screen "${screenName}" was not found.`);
    return;
}

// Hide all screens and show the selected screen.
document.querySelectorAll(".app-screen").forEach((screen) => {
    screen.classList.remove("active-screen");
    screen.hidden = true;
});

targetScreen.hidden = false;
targetScreen.classList.add("active-screen");

// Update the topbar title.
const titleElement = document.getElementById("screen-title");

if (titleElement) {
    titleElement.textContent = screenTitles[screenName] || "TaskForge";
}

// Update the active state on desktop and mobile navigation.
document.querySelectorAll("[data-screen-target]").forEach((button) => {
    const isActive = button.dataset.screenTarget === screenName;

    button.classList.toggle("active", isActive);

    if (button.classList.contains("nav-item") ||
        button.classList.contains("bottom-nav-item")) {
        button.setAttribute("aria-current", isActive ? "page" : "false");
    }
});

// Start each screen at the top.
window.scrollTo({
    top: 0,
    behavior: "smooth"
});


}

// Make every navigation button open its corresponding screen.
document.querySelectorAll("[data-screen-target]").forEach((button) => {
button.addEventListener("click", () => {
showScreen(button.dataset.screenTarget);
});
});

// Open Home when the application first loads.
showScreen("home");


console.log("TaskForge initialized successfully!");


// ============================================
// TASKFORGE — PROFESSIONAL PLANNER
// ============================================

function updatePlanner() {
    const plannerList = document.getElementById("planner-task-list");
    const overdueDisplay = document.getElementById("planner-overdue-count");
    const todayDisplay = document.getElementById("planner-today-count");
    const upcomingDisplay = document.getElementById("planner-upcoming-count");

    if (!plannerList || !overdueDisplay || !todayDisplay || !upcomingDisplay) {
        return;
    }

    plannerList.replaceChildren();

    const now = new Date();
    const today = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );

    const groups = {
        overdue: [],
        today: [],
        upcoming: []
    };

    tasks.forEach(task => {
        if (task.completed || !task.dueDate) {
            return;
        }

        const [year, month, day] = task.dueDate.split("-").map(Number);
        const deadline = new Date(year, month - 1, day);

        // Ignore invalid dates.
        if (
            Number.isNaN(deadline.getTime()) ||
            deadline.getFullYear() !== year ||
            deadline.getMonth() !== month - 1 ||
            deadline.getDate() !== day
        ) {
            return;
        }

        if (deadline < today) {
            groups.overdue.push(task);
        } else if (deadline.getTime() === today.getTime()) {
            groups.today.push(task);
        } else {
            groups.upcoming.push(task);
        }
    });

    // Update deadline summary counters.
    overdueDisplay.textContent = groups.overdue.length;
    todayDisplay.textContent = groups.today.length;
    upcomingDisplay.textContent = groups.upcoming.length;

    const sections = [
        {
            title: "Overdue",
            subtitle: "Deadlines that need your attention",
            className: "planner-overdue",
            tasks: groups.overdue
        },
        {
            title: "Due Today",
            subtitle: "Tasks to focus on today",
            className: "planner-today",
            tasks: groups.today
        },
        {
            title: "Upcoming",
            subtitle: "Prepare for what's ahead",
            className: "planner-upcoming",
            tasks: groups.upcoming
        }
    ];

    sections.forEach(section => {
        const group = document.createElement("section");
        group.className = `planner-group ${section.className}`;

        const heading = document.createElement("h3");
        heading.textContent = section.title;

        const subtitle = document.createElement("p");
        subtitle.className = "planner-group-subtitle";
        subtitle.textContent = section.subtitle;

        group.append(heading, subtitle);

        if (section.tasks.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.className = "planner-empty-state";

            const icon = document.createElement("span");
            icon.className = "planner-empty-icon";
            icon.setAttribute("aria-hidden", "true");

            icon.textContent =
                section.className === "planner-overdue" ? "✓" :
                section.className === "planner-today" ? "☀" : "↗";

            const message = document.createElement("p");
            message.textContent =
                section.className === "planner-overdue"
                    ? "You're all caught up. No overdue tasks."
                    : section.className === "planner-today"
                    ? "Nothing due today. Keep making progress!"
                    : "No upcoming deadlines. Add a due date to plan ahead.";

            emptyMessage.append(icon, message);
            group.appendChild(emptyMessage);
        } else {
            const taskCards = document.createElement("div");
            taskCards.className = "planner-group-tasks";

            section.tasks.forEach(task => {
                const card = document.createElement("article");
                card.className = "planner-task-item";

                const title = document.createElement("strong");
                title.textContent = task.text;

                const details = document.createElement("p");
                details.textContent =
                    `${task.category || "Personal"} · ${task.priority || "Medium"} priority`;

                const deadline = document.createElement("span");
                deadline.className = "planner-deadline-label";

                const [year, month, day] = task.dueDate.split("-").map(Number);
                const dueDate = new Date(year, month - 1, day);

                deadline.textContent = `Due ${dueDate.toLocaleDateString(
                    undefined,
                    {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    }
                )}`;

                card.append(title, details, deadline);
                taskCards.appendChild(card);
            });

            group.appendChild(taskCards);
        }

        plannerList.appendChild(group);
    });
}

       


// ============================================
// TASKFORGE — INSIGHTS SCREEN
// ============================================

function updateInsights() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const remaining = total - completed;

    const rate = total === 0
        ? 0
        : Math.round((completed / total) * 100);

    document.getElementById("insights-total").textContent = total;
    document.getElementById("insights-completed").textContent = completed;
    document.getElementById("insights-remaining").textContent = remaining;
    document.getElementById("insights-rate").textContent = `${rate}%`;

    const categories = [
        {
            name: "Education",
            countId: "insights-education-count",
            barId: "insights-education-bar"
        },
        {
            name: "Work",
            countId: "insights-work-count",
            barId: "insights-work-bar"
        },
        {
            name: "Personal",
            countId: "insights-personal-count",
            barId: "insights-personal-bar"
        }
    ];

    categories.forEach(category => {
        const count = tasks.filter(
            task => (task.category || "Personal") === category.name
        ).length;

        const countElement = document.getElementById(category.countId);
        const barElement = document.getElementById(category.barId);

        if (countElement) {
            countElement.textContent = count;
        }

        if (barElement) {
            const percentage = total === 0
                ? 0
                : Math.round((count / total) * 100);

            barElement.style.width = `${percentage}%`;
            barElement.setAttribute("aria-valuenow", percentage);
            barElement.setAttribute("aria-valuemin", "0");
            barElement.setAttribute("aria-valuemax", "100");
        }
    });
}

