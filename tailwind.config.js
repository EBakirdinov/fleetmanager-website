/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './templates/Fleet/**/*.twig',
        './assets/js/fleet/**/*.js',
    ],
    theme: {
        extend: {
            colors: {
                sidebar: '#0f172a',
                'fleet-primary': '#2563eb',
                'fleet-primary-hover': '#1d4ed8',
                'fleet-accent': '#f97316',
                'surface-base': '#0f172a',
                'surface-card': '#1e293b',
                'surface-hover': '#334155',
                'surface-border': '#334155',
                'text-heading': '#f8fafc',
                'text-body': '#cbd5e1',
                'text-muted': '#64748b',
                'status-booked': '#3b82f6',
                'status-dispatched': '#a855f7',
                'status-transit': '#f97316',
                'status-delivered': '#22c55e',
                'status-cancelled': '#ef4444',
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
