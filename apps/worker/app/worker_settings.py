"""Queue registry — maps BullMQ queue names to their processor functions.

Queue names match api-gateway/src/queue/ producer names 1:1, and each name
matches its module in app/tasks/ for easy tracing (see README).
"""
