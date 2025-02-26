import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Ticket as Cricket, Users, Trophy, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import type { RootState } from '../store';
import { signOut } from '../store/slices/authSlice';

const Navbar = () => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await dispatch(signOut());
    navigate('/login');
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Cricket className="w-8 h-8" />
            <span className="font-bold text-xl">CricketPro</span>
          </Link>
          
          <div className="flex items-center space-x-6">
            <Link to="/matches" className="flex items-center space-x-1 hover:text-blue-200">
              <Trophy className="w-5 h-5" />
              <span>Matches</span>
            </Link>
            <Link to="/teams" className="flex items-center space-x-1 hover:text-blue-200">
              <Users className="w-5 h-5" />
              <span>Teams</span>
            </Link>
            <Link to="/players" className="flex items-center space-x-1 hover:text-blue-200">
              <User className="w-5 h-5" />
              <span>Players</span>
            </Link>
            <Link to="/tournaments" className="flex items-center space-x-1 hover:text-blue-200">
              <Trophy className="w-5 h-5" />
              <span>Tournaments</span>
            </Link>
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center space-x-2 hover:text-blue-200 focus:outline-none"
                >
                  <User className="w-5 h-5" />
                  <span>{user?.name}</span>
                  <span className="text-sm opacity-75">({user?.role})</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                      </div>
                    </Link>
                    
                    {user?.role === 'super_admin' && (
                      <Link
                        to="/admin/users"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <div className="flex items-center space-x-2">
                          <Settings className="w-4 h-4" />
                          <span>User Management</span>
                        </div>
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                    >
                      <div className="flex items-center space-x-2">
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="hover:text-blue-200">Login</Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;