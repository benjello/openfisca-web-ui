# -*- coding: utf-8 -*-


# OpenFisca -- A versatile microsimulation software
# By: OpenFisca Team <contact@openfisca.fr>
#
# Copyright (C) 2011, 2012, 2013, 2014 OpenFisca Team
# https://github.com/openfisca
#
# This file is part of OpenFisca.
#
# OpenFisca is free software; you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as
# published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.
#
# OpenFisca is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


"""Controllers for visualizations"""


import collections
import logging
import pymongo
import re

import webob

from .. import contexts, conv, model, paginations, templates, urls, wsgihelpers


inputs_to_legislation_data = conv.pipe(
    conv.struct(
        dict(
            author_id = conv.base.input_to_uuid,
            description = conv.cleanup_text,
            enabled = conv.guess_bool,
            featured = conv.guess_bool,
            iframe = conv.guess_bool,
            image_filename = conv.cleanup_line,
            organization = conv.cleanup_line,
            title = conv.pipe(
                conv.base.cleanup_line,
                conv.not_none,
                ),
            url = conv.make_input_to_url(full = True),
            ),
        default = 'drop',
        ),
    conv.test(lambda struct: struct.get('url') is not None or struct.get('json') is not None),
    )
log = logging.getLogger(__name__)


@wsgihelpers.wsgify
def admin_delete():
    pass


@wsgihelpers.wsgify
def admin_edit():
    pass


@wsgihelpers.wsgify
def admin_index(req):
    ctx = contexts.Ctx(req)
    model.is_admin(ctx, check = True)

    assert req.method == 'GET'
    params = req.GET
    inputs = dict(
        advanced_search = params.get('advanced_search'),
        page = params.get('page'),
        sort = params.get('sort'),
        term = params.get('term'),
        )
    data, errors = conv.pipe(
        conv.struct(
            dict(
                advanced_search = conv.guess_bool,
                page = conv.pipe(
                    conv.input_to_int,
                    conv.test_greater_or_equal(1),
                    conv.default(1),
                    ),
                sort = conv.pipe(
                    conv.cleanup_line,
                    conv.test_in(['slug', 'updated']),
                    ),
                term = conv.base.input_to_words,
                ),
            ),
        conv.rename_item('page', 'page_number'),
        )(inputs, state = ctx)
    if errors is not None:
        return wsgihelpers.not_found(ctx, explanation = ctx._('Visualization search error: {}').format(errors))
    criteria = {}
    if data['term'] is not None:
        criteria['words'] = {'$all': [
            re.compile(u'^{}'.format(re.escape(word)))
            for word in data['term']
            ]}
    cursor = model.Visualization.find(criteria, as_class = collections.OrderedDict)
    pager = paginations.Pager(item_count = cursor.count(), page_number = data['page_number'])
    if data['sort'] == 'slug':
        cursor.sort([('slug', pymongo.ASCENDING)])
    elif data['sort'] == 'updated':
        cursor.sort([(data['sort'], pymongo.DESCENDING), ('slug', pymongo.ASCENDING)])
    visualizations = cursor.skip(pager.first_item_index or 0).limit(pager.page_size)
    return templates.render(
        ctx,
        '/visualizations/admin-index.mako',
        data = data,
        errors = errors,
        visualizations = visualizations,
        inputs = inputs,
        pager = pager,
        )


@wsgihelpers.wsgify
def admin_new(req):
    ctx = contexts.Ctx(req)
    user = model.get_user(ctx)

    if user is None or user.email is None:
        return wsgihelpers.unauthorized(ctx)

    visualization = model.Visualization()
    if req.method == 'GET':
        errors = None
        inputs = extract_legislation_inputs_from_params(ctx)
    else:
        assert req.method == 'POST'
        inputs = extract_legislation_inputs_from_params(ctx, req.POST)
        inputs['author_id'] = user._id
        data, errors = inputs_to_legislation_data(inputs, state = ctx)
        if errors is None:
            data['slug'], error = conv.pipe(
                conv.input_to_slug,
                conv.not_none,
                )(data['title'], state = ctx)
            if error is not None:
                errors = dict(title = error)
        if errors is None:
            if model.Visualization.find(
                    dict(
                        slug = data['slug'],
                        ),
                    as_class = collections.OrderedDict,
                    ).count() > 0:
                errors = dict(full_name = ctx._('A visualization with the same name already exists.'))
        if errors is None:
            visualization.set_attributes(**data)
            visualization.compute_words()
            visualization.save(safe = True)

            # View visualization.
            return wsgihelpers.redirect(ctx, location = visualization.get_admin_url(ctx))
    return templates.render(
        ctx,
        '/visualizations/admin-new.mako',
        errors = errors,
        inputs = inputs,
        visualization = visualization,
        )


@wsgihelpers.wsgify
def admin_view(req):
    ctx = contexts.Ctx(req)
    visualization = ctx.node
    return templates.render(ctx, '/visualizations/admin-view.mako', visualization = visualization)


def extract_legislation_inputs_from_params(ctx, params = None):
    if params is None:
        params = webob.multidict.MultiDict()
    return dict(
        description = params.get('description'),
        enabled = params.get('enabled'),
        featured = params.get('featured'),
        iframe = params.get('iframe'),
        image_filename = params.get('image_filename'),
        organization = params.get('organization'),
        title = params.get('title'),
        url = params.get('url'),
        )


def route_admin(environ, start_response):
    req = webob.Request(environ)
    ctx = contexts.Ctx(req)

    visualization, error = conv.pipe(
        conv.input_to_slug,
        conv.not_none,
        model.Visualization.make_id_or_slug_or_words_to_instance(),
        )(req.urlvars.get('id_or_slug_or_words'), state = ctx)
    if error is not None:
        return wsgihelpers.not_found(ctx, explanation = ctx._('Visualization Error: {}').format(error))(
            environ, start_response)

    ctx.node = visualization

    router = urls.make_router(
        ('GET', '^/?$', admin_view),
        (('GET', 'POST'), '^/delete/?$', admin_delete),
        (('GET', 'POST'), '^/edit/?$', admin_edit),
        )
    return router(environ, start_response)


def route_admin_class(environ, start_response):
    router = urls.make_router(
        ('GET', '^/?$', admin_index),
        (('GET', 'POST'), '^/new/?$', admin_new),
        (None, '^/(?P<id_or_slug_or_words>[^/]+)(?=/|$)', route_admin),
        )
    return router(environ, start_response)


def route_user(environ, start_response):
    router = urls.make_router(
        ('GET', '^/?$', user_index),
        ('GET', '^/new?$', admin_new),
        ('GET', '^/(?P<id_or_slug>[^/]+)/edit/?$', user_edit),
        ('GET', '^/(?P<id_or_slug>[^/]+)/?$', user_view),
        )
    return router(environ, start_response)


@wsgihelpers.wsgify
def user_edit():
    pass


@wsgihelpers.wsgify
def user_index(req):
    ctx = contexts.Ctx(req)

    params = req.GET
    inputs = dict(
        advanced_search = params.get('advanced_search'),
        page = params.get('page'),
        sort = params.get('sort'),
        term = params.get('term'),
        )
    data, errors = conv.pipe(
        conv.struct(
            dict(
                advanced_search = conv.guess_bool,
                page = conv.pipe(
                    conv.input_to_int,
                    conv.test_greater_or_equal(1),
                    conv.default(1),
                    ),
                sort = conv.pipe(
                    conv.cleanup_line,
                    conv.test_in(['slug', 'updated']),
                    ),
                term = conv.base.input_to_words,
                ),
            ),
        conv.rename_item('page', 'page_number'),
        )(inputs, state = ctx)
    if errors is not None:
        return wsgihelpers.not_found(ctx, explanation = ctx._('Visualization search error: {}').format(errors))
    criteria = {}
    if data['term'] is not None:
        criteria['words'] = {'$all': [
            re.compile(u'^{}'.format(re.escape(word)))
            for word in data['term']
            ]}
    cursor = model.Visualization.find(criteria, as_class = collections.OrderedDict)
    pager = paginations.Pager(item_count = cursor.count(), page_number = data['page_number'])
    if data['sort'] == 'slug':
        cursor.sort([('slug', pymongo.ASCENDING)])
    elif data['sort'] == 'updated':
        cursor.sort([(data['sort'], pymongo.DESCENDING), ('slug', pymongo.ASCENDING)])
    visualizations = cursor.skip(pager.first_item_index or 0).limit(pager.page_size)
    return templates.render(
        ctx,
        '/visualizations/user-index.mako',
        data = data,
        errors = errors,
        visualizations = visualizations,
        inputs = inputs,
        pager = pager,
        )


@wsgihelpers.wsgify
def user_view():
    pass