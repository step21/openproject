#-- encoding: UTF-8
#-- copyright
# OpenProject is a project management system.
# Copyright (C) 2012-2018 the OpenProject Foundation (OPF)
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2017 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See docs/COPYRIGHT.rdoc for more details.
#++

require 'legacy_spec_helper'

describe Forum, type: :model do
  fixtures :all

  before do
    @project = Project.find(1)
  end

  it 'should create' do
    forum = Forum.new(project: @project, name: 'Test forum', description: 'Test forum description')
    assert forum.save
    forum.reload
    assert_equal 'Test forum', forum.name
    assert_equal 'Test forum description', forum.description
    assert_equal @project, forum.project
    assert_equal 0, forum.topics_count
    assert_equal 0, forum.messages_count
    assert_nil forum.last_message
    # last position
    assert_equal @project.forums.size, forum.position
  end

  it 'should destroy' do
    forum = Forum.find(1)
    assert_difference 'Message.count', -6 do
      assert_difference 'Attachment.count', -1 do
        assert_difference 'Watcher.count', -1 do
          assert forum.destroy
        end
      end
    end
    assert_equal 0, Message.where(forum_id: 1).count
  end
end
