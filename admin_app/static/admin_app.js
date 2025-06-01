// admin_app/static/admin_app.js

document.addEventListener("DOMContentLoaded", () => {
  console.log("Admin JS loaded");
});

function logoutConfirm(email) {
  if (confirm(`${email} としてログアウトしますか？`)) {
    window.location.href = "/logout";
  }
}