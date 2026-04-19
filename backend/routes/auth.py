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
        
        # Fallback sync
        try:
            auth_client = get_supabase_client(access_token=access_token)
            auth_client.table('candidates').upsert({
                'id': user_id,
                'name': session['user_name']
            }).execute()
        except: pass
        
        return jsonify({"success": True, "redirect": url_for("landing_page")}), 200
        
    return jsonify({"success": False, "error": "Missing token or user_id"}), 400
