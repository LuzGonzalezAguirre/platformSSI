-- ============================================
-- PROBLEM CONTROL INITIAL MIGRATION
-- PostgreSQL function for problem number generation
-- ============================================

-- Function for thread-safe number generation
CREATE OR REPLACE FUNCTION get_next_problem_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    next_seq INT;
    current_week INT;
    current_year INT;
    problem_num VARCHAR(20);
BEGIN
    -- Lock row for update (thread-safe)
    SELECT current_value + 1 INTO next_seq
    FROM problem_control_sequence
    WHERE id = 1
    FOR UPDATE;
    
    -- Update sequence
    UPDATE problem_control_sequence
    SET current_value = next_seq
    WHERE id = 1;
    
    -- Format: CA-WW-YY-NNNN
    current_week := EXTRACT(WEEK FROM NOW());
    current_year := EXTRACT(YEAR FROM NOW()) % 100;  -- Last 2 digits
    
    problem_num := 'CA-' || 
                   LPAD(current_week::TEXT, 2, '0') || '-' ||
                   LPAD(current_year::TEXT, 2, '0') || '-' ||
                   LPAD(next_seq::TEXT, 4, '0');
    
    RETURN problem_num;
END;
$$ LANGUAGE plpgsql;


-- Initialize sequence table
INSERT INTO problem_control_sequence (id, current_value, year)
VALUES (1, 0, EXTRACT(YEAR FROM NOW()))
ON CONFLICT (id) DO NOTHING;


-- Initialize SLA settings (con NOW() para updated_at)
INSERT INTO problem_control_sla_settings (id, d3_hours, d4_days, d5_days, d6_days, d7_days, updated_at)
VALUES (1, 48, 10, 20, 20, 30, NOW())
ON CONFLICT (id) DO NOTHING;


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_problem_status_created 
ON problem_control_problem(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_problem_created_by 
ON problem_control_problem(created_by_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_problem_status 
ON problem_control_stage(problem_id, status);

CREATE INDEX IF NOT EXISTS idx_stage_overdue 
ON problem_control_stage(due_date) 
WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_problem_created 
ON problem_control_audit_log(problem_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_user_created 
ON problem_control_audit_log(user_id, created_at DESC);