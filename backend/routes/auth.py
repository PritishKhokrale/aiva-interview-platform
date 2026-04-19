import functools
from flask import Blueprint, request, session, redirect, url_for, flash, render_template, jsonify
from database.supabase_client import get_supabase_client

auth_bp = Blueprint('auth', __name__)

def login_required(view):
    """Decorator to ensure user is logged in before accessing a route."""
    @functools.wraps(view)
    def wrapped_view(*args, **kwargs):
        if 'access_token' not in session:
            flash("Please log in to access this page.", "error")
            return redirect(url_for('auth.login_page'))
        return view(*args, **kwargs)
    return wrapped_view

@auth_bp.route('/login', methods=['GET'])
def login_page():
    import os
    return render_template('login.html', os=os)

@auth_bp.route('/signup', methods=['GET'])
def signup_page():
    import os
    return render_template('signup.html', os=os)

@auth_bp.route('/hr/login', methods=['GET'])
def hr_login_page():
    import os
    return render_template('hr_login.html', os=os)

@auth_bp.route('/hr/signup', methods=['GET'])
def hr_signup_page():
    import os
    return render_template('hr_signup.html', os=os)

@auth_bp.route('/login', methods=['POST'])
def login_post():
    email = request.form.get('email')
    password = request.form.get('password')
    supabase = get_supabase_client()
    
    if supabase:
        try:
            res = supabase.auth.sign_in_with_password({"email": email, "password": password})
            session['access_token'] = res.session.access_token
            session['user_id'] = res.user.id
            session['user_name'] = res.user.user_metadata.get('full_name', 'User')
            session['email'] = res.user.email if hasattr(res.user, 'email') else email
            # Centralized Failsafe: If they are an HR admin but accidentally used the Candidate Login
            is_hr = False
            try:
                auth_client = get_supabase_client(access_token=res.session.access_token)
                hr_check = auth_client.table('hr_profiles').select('id').eq('id', res.user.id).execute()
                if hr_check.data and len(hr_check.data) > 0:
                    is_hr = True
            except Exception as e:
                pass
                
            if is_hr:
                session['role'] = 'hr'
                return redirect(url_for('hr_dashboard_page'))
            else:
                session['role'] = 'candidate'
                # Fallback sync to candidates table
                try:
                    auth_client = get_supabase_client(access_token=res.session.access_token)
                    auth_client.table('candidates').upsert({
                        'id': res.user.id,
                        'name': session['user_name'],
                        'email': email
                    }).execute()
                except Exception as e:
                    print(f"Fallback candidate sync failed: {e}")
                    
                return redirect(url_for('landing_page'))
        except Exception as e:
            flash(str(e), 'error')
            return redirect(url_for('auth.login_page'))
    
    flash("Database connection failed", "error")
    return redirect(url_for('auth.login_page'))

@auth_bp.route('/signup', methods=['POST'])
def signup_post():
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')
    supabase = get_supabase_client()
    
    if supabase:
        try:
            # 1. Register with Auth
            res = supabase.auth.sign_up({"email": email, "password": password, "options": {"data": {"full_name": name}}})
            user_id = res.user.id
            
            # NOTE: We now rely on a Supabase Database Trigger to insert the user into `candidates`.
            # This bypasses RLS restrictions that occur when email confirmations are enabled 
            # (which causes res.session to be None).
            
            if res.session:
                session['access_token'] = res.session.access_token
                session['user_id'] = user_id
                session['user_name'] = res.user.user_metadata.get('full_name', 'User')
                session['role'] = 'candidate'
                
                # Fallback sync to candidates table
                try:
                    auth_client = get_supabase_client(access_token=res.session.access_token)
                    auth_client.table('candidates').upsert({
                        'id': user_id,
                        'name': session['user_name'],
                        'email': email
                    }).execute()
                except Exception as e:
                    print(f"Fallback candidate sync failed: {e}")
                    
                return redirect(url_for('landing_page'))
                
            flash("Account created! Please log in (or check email for verification).", "success")
            return redirect(url_for('auth.login_page'))
            
        except Exception as e:
            flash(str(e), 'error')
            return redirect(url_for('auth.signup_page'))
            
    flash("Database connection failed", "error")
    return redirect(url_for('auth.signup_page'))

@auth_bp.route('/hr/login', methods=['POST'])
def hr_login_post():
    email = request.form.get('email')
    password = request.form.get('password')
    supabase = get_supabase_client()
    
    if supabase:
        try:
            res = supabase.auth.sign_in_with_password({"email": email, "password": password})
            session['access_token'] = res.session.access_token
            session['user_id'] = res.user.id
            session['user_name'] = res.user.user_metadata.get('full_name', 'HR Administrator')
            session['email'] = res.user.email if hasattr(res.user, 'email') else email
            session['role'] = 'hr'
            
            # Fallback sync to hr_profiles table
            try:
                auth_client = get_supabase_client(access_token=res.session.access_token)
                auth_client.table('hr_profiles').upsert({
                    'id': res.user.id,
                    'name': session['user_name'],
                    'email': email
                }).execute()
            except Exception as e:
                print(f"Fallback HR sync failed (table might not exist yet): {e}")
                
            return redirect(url_for('hr_dashboard_page'))
        except Exception as e:
            flash(str(e), 'error')
            return redirect(url_for('auth.hr_login_page'))
    
    flash("Database connection failed", "error")
    return redirect(url_for('auth.hr_login_page'))

@auth_bp.route('/hr/signup', methods=['POST'])
def hr_signup_post():
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')
    supabase = get_supabase_client()
    
    if supabase:
        try:
            res = supabase.auth.sign_up({"email": email, "password": password, "options": {"data": {"full_name": name}}})
            user_id = res.user.id
            
            if res.session:
                session['access_token'] = res.session.access_token
                session['user_id'] = user_id
                session['user_name'] = res.user.user_metadata.get('full_name', 'HR Administrator')
                session['role'] = 'hr'
                
                # Fallback sync to hr_profiles table
                try:
                    auth_client = get_supabase_client(access_token=res.session.access_token)
                    auth_client.table('hr_profiles').upsert({
                        'id': user_id,
                        'name': session['user_name'],
                        'email': email
                    }).execute()
                except Exception as e:
                    print(f"Fallback HR sync failed (table might not exist yet): {e}")
                    
                return redirect(url_for('hr_dashboard_page'))
                
            flash("HR Account created! Please log in (or check email for verification).", "success")
            return redirect(url_for('auth.hr_login_page'))
            
        except Exception as e:
            flash(str(e), 'error')
            return redirect(url_for('auth.hr_signup_page'))
            
    flash("Database connection failed", "error")
    return redirect(url_for('auth.hr_signup_page'))

@auth_bp.route('/logout', methods=['GET'])
def logout():
    session.clear()
    return redirect(url_for('landing_page'))

@auth_bp.route('/callback')
def callback():
    """ Renders the Javascript extraction template to parse OAuth hash tokens """
    import os
    return render_template('callback.html', os=os)

@auth_bp.route('/set_session', methods=['POST'])
def set_session():
    """ Receives validated access_token and user_id from frontend Javascript """
    data = request.json or {}
    access_token = data.get('access_token')
    user_id = data.get('user_id')
    
    if access_token and user_id:
        session['access_token'] = access_token
        session['user_id'] = user_id
        session['user_name'] = data.get('user_name', 'User')
        session['email'] = data.get('email', '')
        
        # Failsafe: In case of OAuth localStorage drop, aggressively check if they are HR
        is_hr = False
        try:
            auth_client = get_supabase_client(access_token=access_token)
            hr_check = auth_client.table('hr_profiles').select('id').eq('id', user_id).execute()
            if hr_check.data and len(hr_check.data) > 0:
                is_hr = True
        except:
            pass
            
        role = data.get('role', 'candidate')
        if is_hr:
            role = 'hr'
            
        session['role'] = role
        
        # Fallback sync
        try:
            auth_client = get_supabase_client(access_token=access_token)
            if role == 'hr':
                auth_client.table('hr_profiles').upsert({
                    'id': user_id,
                    'name': session['user_name'],
                    'email': session['email']
                }).execute()
            else:
                auth_client.table('candidates').upsert({
                    'id': user_id,
                    'name': session['user_name'],
                    'email': session['email']
                }).execute()
        except Exception as e:
            print(f"Fallback sync in set_session failed: {e}")
        
        target_route = "hr_dashboard_page" if role == 'hr' else "landing_page"
        return jsonify({"success": True, "redirect": url_for(target_route)}), 200
        
    return jsonify({"success": False, "error": "Missing token or user_id"}), 400
