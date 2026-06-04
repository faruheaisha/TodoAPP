use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use chrono::Local;
use std::time::Duration as StdDuration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: String,
    pub title: String,
    pub todo_type: TodoType,
    pub deadline: Option<String>,
    pub completed: bool,
    pub created_at: String,
    pub reminder_sent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TodoType {
    Quick,
    Longterm,
}

fn parse_row(row: &(String, String, String, Option<String>, bool, String, bool)) -> Todo {
    let todo_type = match row.2.as_str() {
        "longterm" => TodoType::Longterm,
        _ => TodoType::Quick,
    };
    Todo {
        id: row.0.clone(),
        title: row.1.clone(),
        todo_type,
        deadline: row.3.clone(),
        completed: row.4,
        created_at: row.5.clone(),
        reminder_sent: row.6,
    }
}

/// Initialize the SQLite database on first run
#[tauri::command]
pub async fn init_database(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    db.execute(
        r#"
        CREATE TABLE IF NOT EXISTS todos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            todo_type TEXT NOT NULL DEFAULT 'quick',
            deadline TEXT,
            completed INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            reminder_sent INTEGER NOT NULL DEFAULT 0
        );
        "#,
        (),
    )
    .await
    .map(|_| ())
    .map_err(|e| e.to_string())
}

/// Create a new todo
#[tauri::command]
pub async fn create_todo(
    app: tauri::AppHandle,
    title: String,
    todo_type: TodoType,
    deadline: Option<String>,
) -> Result<Todo, String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = Local::now().to_rfc3339();
    let type_str = match todo_type {
        TodoType::Quick => "quick",
        TodoType::Longterm => "longterm",
    };

    db.execute(
        "INSERT INTO todos (id, title, todo_type, deadline, completed, created_at) VALUES (?, ?, ?, ?, 0, ?)",
        (id.clone(), title, type_str, deadline, created_at.clone()),
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(Todo {
        id,
        title,
        todo_type,
        deadline,
        completed: false,
        created_at,
        reminder_sent: false,
    })
}

/// Update a todo (title, deadline, type, completed)
#[tauri::command]
pub async fn update_todo(
    app: tauri::AppHandle,
    id: String,
    title: Option<String>,
    todo_type: Option<TodoType>,
    deadline: Option<String>,
    completed: Option<bool>,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();

    if let Some(t) = title {
        db.execute("UPDATE todos SET title = ? WHERE id = ?", (t, id.clone()))
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(tt) = todo_type {
        let type_str = match tt {
            TodoType::Quick => "quick",
            TodoType::Longterm => "longterm",
        };
        db.execute("UPDATE todos SET todo_type = ? WHERE id = ?", (type_str, id.clone()))
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(d) = deadline {
        db.execute("UPDATE todos SET deadline = ? WHERE id = ?", (d, id.clone()))
            .await
            .map_err(|e| e.to_string())?;
    }
    if let Some(c) = completed {
        db.execute("UPDATE todos SET completed = ? WHERE id = ?", (c, id.clone()))
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Delete a todo by ID
#[tauri::command]
pub async fn delete_todo(
    app: tauri::AppHandle,
    id: String,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    db.execute("DELETE FROM todos WHERE id = ?", (id,))
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Get all todos, sorted by type and deadline
#[tauri::command]
pub async fn get_all_todos(
    app: tauri::AppHandle,
) -> Result<Vec<Todo>, String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    let rows = db
        .query::<(String, String, String, Option<String>, bool, String, bool)>(
            r#"
            SELECT id, title, todo_type, deadline, completed, created_at, reminder_sent
            FROM todos
            ORDER BY
                completed ASC,
                CASE
                    WHEN todo_type = 'longterm' AND deadline IS NOT NULL THEN 1
                    WHEN todo_type = 'longterm' THEN 2
                    ELSE 3
                END,
                deadline ASC,
                created_at DESC
            "#,
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let todos: Vec<Todo> = rows.into_iter().map(parse_row).collect();
    Ok(todos)
}

/// Check for todos that are due soon and emit a notification
#[tauri::command]
pub async fn check_due_soon_todos(
    app: tauri::AppHandle,
) -> Result<Vec<Todo>, String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    let rows = db
        .query::<(String, String, String, Option<String>, bool, String, bool)>(
            r#"
            SELECT id, title, todo_type, deadline, completed, created_at, reminder_sent
            FROM todos
            WHERE completed = 0
              AND deadline IS NOT NULL
              AND deadline != ''
            ORDER BY deadline ASC
            "#,
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let todos: Vec<Todo> = rows.into_iter().map(parse_row).collect();

    let now = Local::now();
    let urgent_todos: Vec<Todo> = todos
        .into_iter()
        .filter(|todo| {
            if let Some(deadline_str) = &todo.deadline {
                if let Ok(deadline) = chrono::DateTime::parse_from_rfc3339(deadline_str) {
                    let diff = deadline.signed_duration_since(now);
                    !todo.reminder_sent && diff.num_minutes() > 0 && diff.num_minutes() <= 1440
                } else {
                    false
                }
            } else {
                false
            }
        })
        .collect();

    for todo in &urgent_todos {
        let _ = app.emit("todo-reminder", todo);
        let _ = db.execute(
            "UPDATE todos SET reminder_sent = 1 WHERE id = ?",
            (todo.id.clone(),),
        );
    }

    Ok(urgent_todos)
}

/// Clear reminder flags for today
#[tauri::command]
pub async fn clear_reminder_flags(
    app: tauri::AppHandle,
) -> Result<(), String> {
    let db = app.state::<tauri_plugin_sql::Sql<tauri_plugin_sql::Sqlite>>();
    db.execute("UPDATE todos SET reminder_sent = 0", ())
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            // Schedule reminder check after startup delay
            tokio::spawn(async move {
                tokio::time::sleep(StdDuration::from_secs(300)).await;
                let _ = app_handle.emit("startup-prompt", ());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            init_database,
            create_todo,
            update_todo,
            delete_todo,
            get_all_todos,
            check_due_soon_todos,
            clear_reminder_flags,
        ])
        .run(tauri::generate_context!())
        .expect("error while running todoapp");
}
