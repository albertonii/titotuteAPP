// Performance tracking application
class PerformanceTracker {
    constructor() {
        this.performances = this.loadPerformances();
        this.form = document.getElementById('performance-form');
        this.performanceList = document.getElementById('performance-list');
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.renderPerformances();
        this.updateStats();
    }

    handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const performance = {
            id: Date.now(),
            subject: formData.get('subject'),
            topic: formData.get('topic'),
            duration: parseInt(formData.get('duration')),
            exercises: parseInt(formData.get('exercises')),
            score: parseFloat(formData.get('score')),
            notes: formData.get('notes'),
            date: new Date().toISOString()
        };

        this.addPerformance(performance);
        this.form.reset();
        this.showSuccessMessage();
    }

    addPerformance(performance) {
        this.performances.unshift(performance);
        this.savePerformances();
        this.renderPerformances();
        this.updateStats();
    }

    deletePerformance(id) {
        this.performances = this.performances.filter(p => p.id !== id);
        this.savePerformances();
        this.renderPerformances();
        this.updateStats();
    }

    renderPerformances() {
        if (this.performances.length === 0) {
            this.performanceList.innerHTML = '<p class="empty-message">No hay registros aún. ¡Comienza registrando tu primera sesión!</p>';
            return;
        }

        this.performanceList.innerHTML = this.performances.map(p => `
            <div class="performance-item">
                <button class="btn-delete" onclick="tracker.deletePerformance(${p.id})" title="Eliminar registro">×</button>
                <div class="performance-header">
                    <span class="performance-subject">${this.escapeHtml(p.subject)}</span>
                    <span class="performance-score">${p.score}/10</span>
                </div>
                <div class="performance-date">${this.formatDate(p.date)}</div>
                <div><strong>Tema:</strong> ${this.escapeHtml(p.topic)}</div>
                <div class="performance-details">
                    <div class="performance-detail">
                        <strong>⏱️ Duración:</strong> ${p.duration} min
                    </div>
                    <div class="performance-detail">
                        <strong>📝 Ejercicios:</strong> ${p.exercises}
                    </div>
                    <div class="performance-detail">
                        <strong>✅ Nota:</strong> ${p.score}/10
                    </div>
                </div>
                ${p.notes ? `<div class="performance-notes">💭 ${this.escapeHtml(p.notes)}</div>` : ''}
            </div>
        `).join('');
    }

    updateStats() {
        const totalSessions = this.performances.length;
        const totalTime = this.performances.reduce((sum, p) => sum + p.duration, 0);
        const averageScore = totalSessions > 0 
            ? (this.performances.reduce((sum, p) => sum + p.score, 0) / totalSessions).toFixed(1)
            : '0.0';

        document.getElementById('total-sessions').textContent = totalSessions;
        document.getElementById('total-time').textContent = totalTime;
        document.getElementById('average-score').textContent = averageScore;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        return date.toLocaleDateString('es-ES', options);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccessMessage() {
        const message = document.createElement('div');
        message.className = 'success-message';
        message.textContent = '✓ Rendimiento registrado exitosamente';
        
        const registroSection = document.querySelector('.registro-section');
        registroSection.insertBefore(message, this.form);
        
        setTimeout(() => message.remove(), 3000);
    }

    savePerformances() {
        localStorage.setItem('performances', JSON.stringify(this.performances));
    }

    loadPerformances() {
        const saved = localStorage.getItem('performances');
        return saved ? JSON.parse(saved) : [];
    }
}

// Initialize the app when DOM is ready
let tracker;
document.addEventListener('DOMContentLoaded', () => {
    tracker = new PerformanceTracker();
});
